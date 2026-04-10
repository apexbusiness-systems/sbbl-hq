-- =============================================================================
-- MIGRATION: 20260410120000_stream_validation_system.sql
-- PURPOSE: Validation-run isolation + stream/session policy hardening columns.
-- =============================================================================

create table if not exists public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete set null,
  environment text not null default 'staging',
  source_classification text not null default 'sandbox',
  status text not null default 'running' check (status in ('running', 'verified', 'rejected', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  artifact_json_path text,
  artifact_md_path text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.validation_runs enable row level security;

drop policy if exists "validation_runs_super_admin_read" on public.validation_runs;
create policy "validation_runs_super_admin_read"
  on public.validation_runs
  for select
  to authenticated
  using (public.fn_has_any_role(array['super_admin']::public.app_role[]));

drop policy if exists "validation_runs_super_admin_write" on public.validation_runs;
create policy "validation_runs_super_admin_write"
  on public.validation_runs
  for all
  to authenticated
  using (public.fn_has_any_role(array['super_admin']::public.app_role[]))
  with check (public.fn_has_any_role(array['super_admin']::public.app_role[]));

create index if not exists idx_validation_runs_status_started
  on public.validation_runs (status, started_at desc);

create index if not exists idx_validation_runs_game_id
  on public.validation_runs (game_id, started_at desc);

-- Stream source hardening metadata
alter table if exists public.stream_sources
  add column if not exists source_type text,
  add column if not exists source_classification text,
  add column if not exists provider_name text,
  add column if not exists source_ref_encrypted text,
  add column if not exists ingest_status text,
  add column if not exists ingest_last_checked_at timestamptz,
  add column if not exists risk_flags jsonb default '{}'::jsonb,
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null;

-- Entitlement policy shape
alter table if exists public.stream_entitlements
  add column if not exists starts_at timestamptz,
  add column if not exists issued_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null;

update public.stream_entitlements
set starts_at = coalesce(starts_at, created_at),
    issued_at = coalesce(issued_at, created_at)
where starts_at is null or issued_at is null;

alter table if exists public.stream_entitlements
  alter column starts_at set default now(),
  alter column issued_at set default now();

-- Access session policy shape
alter table if exists public.stream_access_sessions
  add column if not exists game_id uuid references public.games(id) on delete set null,
  add column if not exists device_token_hash text,
  add column if not exists installation_key_hash text,
  add column if not exists user_agent_hash text,
  add column if not exists ip_hash text,
  add column if not exists session_status text,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists resumed_from_session_id uuid references public.stream_access_sessions(id) on delete set null,
  add column if not exists revoked_reason text,
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null;

update public.stream_access_sessions
set first_seen_at = coalesce(first_seen_at, created_at),
    last_seen_at = coalesce(last_seen_at, updated_at),
    session_status = coalesce(session_status, 'active')
where first_seen_at is null
   or last_seen_at is null
   or session_status is null;

alter table if exists public.stream_access_sessions
  alter column first_seen_at set default now(),
  alter column last_seen_at set default now(),
  alter column session_status set default 'active';

create index if not exists idx_stream_access_sessions_game_status_last_seen
  on public.stream_access_sessions (game_id, session_status, last_seen_at desc);

create index if not exists idx_stream_access_sessions_user_status_expires
  on public.stream_access_sessions (user_id, session_status, expires_at);

-- Device profile hardening
alter table if exists public.devices
  add column if not exists device_token_hash text,
  add column if not exists installation_key_hash text,
  add column if not exists user_agent_hash text,
  add column if not exists last_ip_hash text,
  add column if not exists trust_state text,
  add column if not exists first_seen_at timestamptz,
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null;

update public.devices
set first_seen_at = coalesce(first_seen_at, created_at),
    trust_state = coalesce(trust_state, 'unknown')
where first_seen_at is null
   or trust_state is null;

alter table if exists public.devices
  alter column first_seen_at set default now();

create index if not exists idx_devices_user_trust_last_seen
  on public.devices (user_id, trust_state, last_seen_at desc);

-- Comments and reactions validation linkage
create table if not exists public.stream_comments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  stream_session_id uuid references public.stream_access_sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  status text not null default 'accepted' check (status in ('accepted', 'rejected', 'rate_limited', 'moderated', 'deleted')),
  moderation_reason text,
  created_at timestamptz not null default now(),
  validation_run_id uuid references public.validation_runs(id) on delete set null
);

create index if not exists idx_stream_comments_game_status_created
  on public.stream_comments (game_id, status, created_at desc);

alter table if exists public.stream_reactions
  add column if not exists stream_session_id uuid references public.stream_access_sessions(id) on delete set null,
  add column if not exists status text default 'accepted' check (status in ('accepted', 'rejected', 'rate_limited')),
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null;

create index if not exists idx_stream_reactions_game_status_created
  on public.stream_reactions (game_id, status, created_at desc);

-- Materialized viewer counter snapshot for deterministic validation evidence
create table if not exists public.viewer_counters (
  game_id uuid primary key references public.games(id) on delete cascade,
  active_entitled_viewer_count integer not null default 0,
  last_computed_at timestamptz not null default now(),
  validation_run_id uuid references public.validation_runs(id) on delete set null
);

-- Audit correlation + validation tags
alter table if exists public.audit_logs
  add column if not exists actor text,
  add column if not exists outcome text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists validation_run_id uuid references public.validation_runs(id) on delete set null,
  add column if not exists request_id text,
  add column if not exists occurred_at timestamptz;

update public.audit_logs
set occurred_at = coalesce(occurred_at, created_at)
where occurred_at is null;

create index if not exists idx_audit_logs_validation_run
  on public.audit_logs (validation_run_id, occurred_at desc);

create index if not exists idx_audit_logs_request_id
  on public.audit_logs (request_id);

-- Idempotency requirements (global key uniqueness)
create unique index if not exists uq_stream_entitlements_idempotency_key
  on public.stream_entitlements (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists uq_stream_access_sessions_idempotency_key
  on public.stream_access_sessions (idempotency_key)
  where idempotency_key is not null;

-- Updated-at triggers for new tables
DO $$
BEGIN
  IF to_regprocedure('public.touch_updated_at()') IS NOT NULL THEN
    EXECUTE 'drop trigger if exists trg_validation_runs_touch_updated_at on public.validation_runs';
    EXECUTE 'create trigger trg_validation_runs_touch_updated_at before update on public.validation_runs for each row execute function public.touch_updated_at()';
  END IF;
END $$;

-- Server-side cleanup path for expired/revoked sessions
create or replace function public.cleanup_expired_stream_sessions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.stream_access_sessions
  set session_status = 'expired',
      revoked_reason = coalesce(revoked_reason, 'expired_by_cleanup'),
      updated_at = now(),
      last_seen_at = coalesce(last_seen_at, now())
  where session_status in ('active', 'resumable')
    and expires_at <= p_now;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  return v_count;
end;
$$;

create or replace function public.start_validation_run(
  p_game_id uuid,
  p_environment text,
  p_source_classification text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.validation_runs (
    game_id,
    environment,
    source_classification,
    status,
    started_at
  )
  values (
    p_game_id,
    coalesce(p_environment, 'staging'),
    coalesce(p_source_classification, 'sandbox'),
    'running',
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.finish_validation_run(
  p_validation_run_id uuid,
  p_status text,
  p_artifact_json_path text,
  p_artifact_md_path text,
  p_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.validation_runs
  set status = case
      when p_status in ('verified', 'rejected', 'error') then p_status
      else 'error'
    end,
      artifact_json_path = p_artifact_json_path,
      artifact_md_path = p_artifact_md_path,
      summary = coalesce(p_summary, '{}'::jsonb),
      finished_at = now(),
      updated_at = now()
  where id = p_validation_run_id;
end;
$$;
