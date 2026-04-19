-- =============================================================================
-- Migration: Player Biometric Snapshots (WS5)
-- Date:      2026-04-19
-- Owner:     Broadcast Platform
--
-- Purely additive. No drops. game_id stays nullable per Stream
-- Independence Contract. Intended consumer: /1v1 and /2v2 games only;
-- games.event_type = 'full_game' will never emit snapshots even if this
-- table is populated.
--
-- Write path: POST /api/streams/:gameId/biometrics — admin-only (RLS +
-- worker-level role check). Read path: GET .../biometrics/latest — public,
-- returns the most recent snapshot per player (no PII, aggregate-safe).
--
-- Realtime: the `biometrics:{gameId}` broadcast channel fans out deltas
-- to connected overlays. Publication is best-effort (if
-- supabase_realtime does not exist in the local/CI environment the DO
-- block is a no-op).
--
-- Indexing rationale: queries are always "latest per (game_id, player_id)";
-- the DESC index on recorded_at makes the limit-1-per-player path a
-- sorted-index scan. Retention is handled by an ops job (not migration
-- scope) — expect ~30 days of data per game to stay bounded.
-- =============================================================================

create table if not exists public.player_biometric_snapshots (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid,
  player_id       uuid not null,
  heart_rate_bpm  int,
  stamina_pct     int check (stamina_pct is null or (stamina_pct between 0 and 100)),
  fatigue_level   text check (fatigue_level is null or fatigue_level in ('fresh','moderate','tired','gassed')),
  source          text not null default 'manual' check (source in ('manual','webhook','wearable')),
  recorded_at     timestamptz not null default now(),
  created_by      uuid,
  created_at      timestamptz not null default now()
);

-- Hot query: latest snapshot per player per game
create index if not exists idx_biometric_game_player_time
  on public.player_biometric_snapshots(game_id, player_id, recorded_at desc)
  where game_id is not null;

-- Secondary index: per-player time series (for trend charts or replay UI)
create index if not exists idx_biometric_player_time
  on public.player_biometric_snapshots(player_id, recorded_at desc);

alter table public.player_biometric_snapshots enable row level security;

-- Public read: biometric data is performance-aggregate, non-PII, and
-- driving the on-screen overlay. Restricting reads would prevent the
-- overlay from rendering for paying viewers.
drop policy if exists "biometric_public_read" on public.player_biometric_snapshots;
create policy "biometric_public_read"
  on public.player_biometric_snapshots for select
  using (true);

-- Admin-only write. Manual-entry flow uses the admin panel
-- (BiometricAdminPanel) which posts through the worker; the worker
-- verifies the caller has league_admin or super_admin role before
-- inserting. RLS is the defense-in-depth layer.
drop policy if exists "biometric_admin_write" on public.player_biometric_snapshots;
create policy "biometric_admin_write"
  on public.player_biometric_snapshots for insert
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

drop policy if exists "biometric_admin_update" on public.player_biometric_snapshots;
create policy "biometric_admin_update"
  on public.player_biometric_snapshots for update
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- Realtime publication — the overlay subscribes to inserts directly.
-- A manual broadcast from the worker (biometrics:{gameId}) is ALSO
-- emitted for low-latency delivery, so clients have two convergent
-- signals. Either is sufficient; both together is resilient.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_biometric_snapshots'
  ) then
    alter publication supabase_realtime add table public.player_biometric_snapshots;
  end if;
exception when others then
  null;
end $$;
