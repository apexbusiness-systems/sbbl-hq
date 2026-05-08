-- Shadow event core for SBBL HQ basketball operations.
-- Date: 2026-05-08
-- Owner: Sports Operations / Broadcast Platform
-- Mode: additive, feature-flagged, shadow-run only.

create extension if not exists "pgcrypto";

-- Required flags are database-visible for server-side shadow checks while
-- client flag parsing remains in src/lib/feature-flags.ts.
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, description) values
  ('shadow_event_ledger', false, 'Mirror score/stat/broadcast mutations into append-only event ledger.'),
  ('shadow_game_projection', false, 'Rebuild and compare game/standings/career projections without serving them canonically.'),
  ('broadcast_overlay_v2', false, 'Enable OBS read-only overlay card variants.'),
  ('sponsor_analytics_v2', false, 'Enable first-party sponsor exposure and reporting moat.'),
  ('entitlement_tokens_v2', false, 'Enable role-scoped short-lived access token hardening.')
on conflict (key) do nothing;

alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_public_read on public.feature_flags;
create policy feature_flags_public_read on public.feature_flags
  for select using (true);
drop policy if exists feature_flags_admin_write on public.feature_flags;
create policy feature_flags_admin_write on public.feature_flags
  for all using (public.has_any_role(array['super_admin','league_admin']::public.app_role[]))
  with check (public.has_any_role(array['super_admin','league_admin']::public.app_role[]));

create table if not exists public.game_event_ledger (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  sequence bigint not null,
  revision bigint not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  source text not null default 'system',
  idempotency_key text not null,
  supersedes_event_id uuid references public.game_event_ledger(id),
  voided_at timestamptz,
  voided_by uuid,
  created_at timestamptz not null default now(),
  unique (game_id, sequence),
  unique (game_id, idempotency_key)
);

comment on table public.game_event_ledger is
  'Append-only shadow basketball event ledger. Canonical reads stay on current games/stat tables until parity is proven.';

create index if not exists idx_game_event_ledger_game_sequence
  on public.game_event_ledger (game_id, sequence);
create index if not exists idx_game_event_ledger_type_created
  on public.game_event_ledger (event_type, created_at desc);
create index if not exists idx_game_event_ledger_actor_created
  on public.game_event_ledger (actor_id, created_at desc);

alter table public.game_event_ledger enable row level security;
drop policy if exists game_event_ledger_admin_read on public.game_event_ledger;
create policy game_event_ledger_admin_read on public.game_event_ledger
  for select using (public.has_any_role(array['super_admin','league_admin','media_operator','team_manager']::public.app_role[]));
drop policy if exists game_event_ledger_service_write on public.game_event_ledger;
create policy game_event_ledger_service_write on public.game_event_ledger
  for all using (false) with check (false);

create table if not exists public.game_projection_current (
  game_id uuid primary key references public.games(id) on delete cascade,
  last_sequence bigint not null default 0,
  revision bigint not null default 0,
  status text not null default 'scheduled',
  period int not null default 1,
  clock_seconds int not null default 600,
  clock_running boolean not null default false,
  home_score int not null default 0,
  away_score int not null default 0,
  home_fouls int not null default 0,
  away_fouls int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_projection_current_status
  on public.game_projection_current (status, rebuilt_at desc);

alter table public.game_projection_current enable row level security;
drop policy if exists game_projection_current_public_read on public.game_projection_current;
create policy game_projection_current_public_read on public.game_projection_current
  for select using (true);
drop policy if exists game_projection_current_no_client_write on public.game_projection_current;
create policy game_projection_current_no_client_write on public.game_projection_current
  for all using (false) with check (false);

create table if not exists public.standings_projection (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  wins int not null default 0,
  losses int not null default 0,
  ties int not null default 0,
  points_for int not null default 0,
  points_against int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  unique (league_id, season_id, team_id)
);

create index if not exists idx_standings_projection_league_season
  on public.standings_projection (league_id, season_id, wins desc, losses asc);

alter table public.standings_projection enable row level security;
drop policy if exists standings_projection_public_read on public.standings_projection;
create policy standings_projection_public_read on public.standings_projection
  for select using (true);
drop policy if exists standings_projection_no_client_write on public.standings_projection;
create policy standings_projection_no_client_write on public.standings_projection
  for all using (false) with check (false);

create table if not exists public.career_stat_projection (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('player','team')),
  subject_id uuid not null,
  league_id uuid references public.leagues(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  games_played int not null default 0,
  pts int not null default 0,
  reb int not null default 0,
  ast int not null default 0,
  stl int not null default 0,
  blk int not null default 0,
  fls int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  unique (subject_type, subject_id, league_id, season_id)
);

create index if not exists idx_career_stat_projection_subject
  on public.career_stat_projection (subject_type, subject_id);

alter table public.career_stat_projection enable row level security;
drop policy if exists career_stat_projection_public_read on public.career_stat_projection;
create policy career_stat_projection_public_read on public.career_stat_projection
  for select using (true);
drop policy if exists career_stat_projection_no_client_write on public.career_stat_projection;
create policy career_stat_projection_no_client_write on public.career_stat_projection
  for all using (false) with check (false);

create table if not exists public.broadcast_markers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  ledger_event_id uuid references public.game_event_ledger(id) on delete set null,
  marker_type text not null default 'manual',
  label text not null,
  period int,
  clock_seconds int,
  home_score int,
  away_score int,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (game_id, idempotency_key)
);

create index if not exists idx_broadcast_markers_game_created
  on public.broadcast_markers (game_id, created_at desc);

alter table public.broadcast_markers enable row level security;
drop policy if exists broadcast_markers_public_read on public.broadcast_markers;
create policy broadcast_markers_public_read on public.broadcast_markers
  for select using (true);
drop policy if exists broadcast_markers_admin_write on public.broadcast_markers;
create policy broadcast_markers_admin_write on public.broadcast_markers
  for all using (public.has_any_role(array['super_admin','league_admin','media_operator']::public.app_role[]))
  with check (public.has_any_role(array['super_admin','league_admin','media_operator']::public.app_role[]));

create table if not exists public.sponsor_exposures (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid references public.sponsor_slots(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  ledger_event_id uuid references public.game_event_ledger(id) on delete set null,
  exposure_type text not null check (exposure_type in ('overlay_impression','slot_rotation','click','qr_scan','stream_session_start','stream_session_end','page_session','clip_marker')),
  campaign text,
  overlay_slot text,
  session_id text,
  user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (sponsor_id, game_id, exposure_type, idempotency_key)
);

create index if not exists idx_sponsor_exposures_game
  on public.sponsor_exposures (game_id, occurred_at desc);
create index if not exists idx_sponsor_exposures_sponsor
  on public.sponsor_exposures (sponsor_id, occurred_at desc);
create index if not exists idx_sponsor_exposures_campaign
  on public.sponsor_exposures (campaign, overlay_slot, occurred_at desc);

alter table public.sponsor_exposures enable row level security;
drop policy if exists sponsor_exposures_admin_read on public.sponsor_exposures;
create policy sponsor_exposures_admin_read on public.sponsor_exposures
  for select using (public.has_any_role(array['super_admin','league_admin','media_operator']::public.app_role[]));
drop policy if exists sponsor_exposures_service_write on public.sponsor_exposures;
create policy sponsor_exposures_service_write on public.sponsor_exposures
  for all using (false) with check (false);

create table if not exists public.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  object_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processing','processed','duplicate','failed','skipped')),
  error_detail text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  idempotency_key text not null,
  unique (provider, event_id),
  unique (provider, object_id, event_type, idempotency_key)
);

create index if not exists idx_webhook_inbox_status_received
  on public.webhook_inbox (status, received_at desc);
create index if not exists idx_webhook_inbox_object_type
  on public.webhook_inbox (provider, object_id, event_type);

alter table public.webhook_inbox enable row level security;
drop policy if exists webhook_inbox_admin_read on public.webhook_inbox;
create policy webhook_inbox_admin_read on public.webhook_inbox
  for select using (public.has_any_role(array['super_admin','league_admin']::public.app_role[]));
drop policy if exists webhook_inbox_no_client_write on public.webhook_inbox;
create policy webhook_inbox_no_client_write on public.webhook_inbox
  for all using (false) with check (false);

create table if not exists public.shadow_projection_reconciliation (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('game','standings','career','webhook','entitlement')),
  ref_id uuid,
  canonical_payload jsonb not null default '{}'::jsonb,
  shadow_payload jsonb not null default '{}'::jsonb,
  status text not null default 'unresolved' check (status in ('passed','mismatched','unresolved')),
  details text,
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (scope, ref_id, idempotency_key)
);

create index if not exists idx_shadow_projection_reconciliation_status
  on public.shadow_projection_reconciliation (status, created_at desc);

alter table public.shadow_projection_reconciliation enable row level security;
drop policy if exists shadow_projection_reconciliation_admin_read on public.shadow_projection_reconciliation;
create policy shadow_projection_reconciliation_admin_read on public.shadow_projection_reconciliation
  for select using (public.has_any_role(array['super_admin','league_admin','media_operator']::public.app_role[]));
drop policy if exists shadow_projection_reconciliation_no_client_write on public.shadow_projection_reconciliation;
create policy shadow_projection_reconciliation_no_client_write on public.shadow_projection_reconciliation
  for all using (false) with check (false);

create or replace function public.next_game_event_sequence(p_game_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(max(sequence), 0) + 1
  from public.game_event_ledger
  where game_id = p_game_id
$$;

create or replace view public.sponsor_exposure_report_v2 as
select
  sponsor_id,
  game_id,
  campaign,
  overlay_slot,
  exposure_type,
  count(*)::bigint as exposure_count,
  min(occurred_at) as first_seen_at,
  max(occurred_at) as last_seen_at
from public.sponsor_exposures
group by sponsor_id, game_id, campaign, overlay_slot, exposure_type;
