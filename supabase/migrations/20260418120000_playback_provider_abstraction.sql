-- =============================================================================
-- Migration: Playback provider abstraction + replay monetization columns
-- Date:      2026-04-18
-- Owner:     Stream Platform
--
-- Purely additive. No drops. No NOT NULL constraint changes on existing
-- columns. No backfill of historical rows. All new columns default to
-- preserve-current-behavior values so this migration is a no-op at
-- runtime until the corresponding feature flags flip on.
--
-- Adds:
--   1. stream_playback_providers — registry of provider implementations
--      (legacy_embed | native_hls). Seeded with legacy_embed as the
--      default so existing games map to it without any row update.
--   2. stream_playback_tokens — per-session signed token ledger used by
--      the native_hls provider. Empty until FEATURE_SIGNED_PLAYBACK_ENABLED
--      is turned on; existing sessions do not create rows here.
--   3. New columns on games for:
--        - playback provider selection + asset id + signed-URL gating
--        - replay monetization (mode, embargo lift, quality tier, price)
--        - event type (full_game | 1v1 | 2v2) and Mic Up Series tag
--   4. overlay_event_log — append-only log of admin-triggered overlay
--      events (lower-third, trash-talk banner, intro sting). Drives the
--      Supabase realtime `overlay:{gameId}` channel in WS6.
--
-- Stream Independence Contract:
--   game_id remains NULLABLE on stream_playback_tokens. Do not add a
--   NOT NULL constraint here — the contract enforces that playback
--   authority is the signed token itself, not a coupling to games.
--
-- RLS:
--   Uses the canonical has_any_role() RPC and auth.uid() (not a
--   get_user_role helper, which does not exist in this schema).
-- =============================================================================

-- ── 1. stream_playback_providers ────────────────────────────────────────────
create table if not exists public.stream_playback_providers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  is_active    boolean not null default true,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.stream_playback_providers enable row level security;

drop policy if exists "providers_public_read" on public.stream_playback_providers;
create policy "providers_public_read"
  on public.stream_playback_providers for select
  using (is_active = true);

drop policy if exists "providers_admin_all" on public.stream_playback_providers;
create policy "providers_admin_all"
  on public.stream_playback_providers for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

insert into public.stream_playback_providers (name, is_active, config)
values
  ('legacy_embed', true, '{"description":"Passthrough of existing embed URL. Default, zero-risk, preserves current behavior."}'::jsonb),
  ('native_hls',   false, '{"description":"Signed HLS playback. Requires PLAYBACK_TOKEN_SECRET + FEATURE_NATIVE_HLS_PROVIDER."}'::jsonb)
on conflict (name) do nothing;

-- ── 2. stream_playback_tokens ───────────────────────────────────────────────
create table if not exists public.stream_playback_tokens (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.stream_access_sessions(id) on delete cascade,
  user_id         uuid not null,
  game_id         uuid, -- nullable by design; streams are first-class per Stream Independence Contract
  provider        text not null,
  signed_token    text not null,
  expires_at      timestamptz not null,
  max_expires_at  timestamptz not null,
  playback_mode   text not null default 'live' check (playback_mode in ('live','replay')),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);

create index if not exists idx_playback_tokens_session on public.stream_playback_tokens(session_id);
create index if not exists idx_playback_tokens_user on public.stream_playback_tokens(user_id);
create index if not exists idx_playback_tokens_expiry on public.stream_playback_tokens(expires_at) where revoked_at is null;

alter table public.stream_playback_tokens enable row level security;

drop policy if exists "tokens_owner_select" on public.stream_playback_tokens;
create policy "tokens_owner_select"
  on public.stream_playback_tokens for select
  using (user_id = auth.uid());

drop policy if exists "tokens_admin_all" on public.stream_playback_tokens;
create policy "tokens_admin_all"
  on public.stream_playback_tokens for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- ── 3. games columns (additive, default-safe) ───────────────────────────────
alter table public.games
  add column if not exists playback_provider text not null default 'legacy_embed';

alter table public.games
  add column if not exists playback_asset_id text;

alter table public.games
  add column if not exists require_signed_url boolean not null default false;

alter table public.games
  add column if not exists latency_mode text not null default 'standard'
  check (latency_mode in ('standard','low'));

alter table public.games
  add column if not exists replay_mode text not null default 'none'
  check (replay_mode in ('none','raw','edited'));

alter table public.games
  add column if not exists replay_monetization_enabled_at timestamptz;

alter table public.games
  add column if not exists replay_quality_tier text not null default 'raw'
  check (replay_quality_tier in ('raw','edited'));

alter table public.games
  add column if not exists replay_price numeric(8,2);

alter table public.games
  add column if not exists event_type text not null default 'full_game'
  check (event_type in ('full_game','1v1','2v2'));

alter table public.games
  add column if not exists mic_up_series boolean not null default false;

-- ── 4. overlay_event_log ────────────────────────────────────────────────────
create table if not exists public.overlay_event_log (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null,
  event_type    text not null check (event_type in ('trash_talk','lower_third','intro_sting')),
  payload       jsonb not null default '{}'::jsonb,
  triggered_by  uuid not null,
  triggered_at  timestamptz not null default now()
);

create index if not exists idx_overlay_event_log_game_time
  on public.overlay_event_log(game_id, triggered_at desc);

alter table public.overlay_event_log enable row level security;

drop policy if exists "overlay_event_public_read" on public.overlay_event_log;
create policy "overlay_event_public_read"
  on public.overlay_event_log for select
  using (true);

drop policy if exists "overlay_event_admin_all" on public.overlay_event_log;
create policy "overlay_event_admin_all"
  on public.overlay_event_log for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));
