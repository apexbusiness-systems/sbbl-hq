-- P2-A: RLS auto-enforce event trigger + rls_audit log
--
-- Problem: any new table added to the public schema without explicit
-- "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" is silently world-readable.
-- This migration installs a DDL event trigger that:
--   1. Automatically enables RLS on every new public schema table.
--   2. Logs the event to rls_audit for review.
--
-- The trigger fires on CREATE TABLE — even when run by Supabase migrations
-- or the dashboard. It does NOT retroactively patch existing tables (those
-- were handled by 20260404000100_backfill_missing_rls_policies.sql).

-- ── Audit log ──────────────────────────────────────────────────────────────
create table if not exists public.rls_audit (
  id          bigint  generated always as identity primary key,
  table_name  text    not null,
  schema_name text    not null default 'public',
  action      text    not null,    -- 'auto_enabled' | 'policy_missing_warning'
  detail      text,
  triggered_by text  not null default 'event_trigger',
  created_at  timestamptz not null default now()
);

comment on table public.rls_audit is
  'Audit log for automatic RLS enforcement and policy gap detection.';

-- RLS on the audit table itself (admin-only read, append-only insert via trigger)
alter table public.rls_audit enable row level security;

create policy "rls_audit_admin_read"
  on public.rls_audit
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_role_assignments ura
      where ura.user_id = (select auth.uid())
        and ura.role in ('super_admin', 'league_admin')
    )
  );

-- The trigger function itself inserts via SECURITY DEFINER so no INSERT
-- policy is needed for the trigger's execution context.

-- ── Event trigger function ─────────────────────────────────────────────────
create or replace function public.fn_auto_enable_rls()
returns event_trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  tbl_name text;
  sch_name text;
begin
  -- Iterate over all DDL commands in this transaction
  for r in select * from pg_event_trigger_ddl_commands() loop
    -- Only act on base tables in the public schema
    if r.command_tag = 'CREATE TABLE'
       and r.schema_name = 'public'
       and r.object_type = 'table' then

      tbl_name := r.object_identity;  -- e.g. "public.new_table"
      sch_name := r.schema_name;

      -- Enable RLS
      execute format('alter table %s enable row level security', tbl_name);

      -- Log the auto-enforcement
      insert into public.rls_audit (table_name, schema_name, action, detail)
      values (
        split_part(tbl_name, '.', 2),
        sch_name,
        'auto_enabled',
        format(
          'RLS automatically enabled on table %s by fn_auto_enable_rls event trigger.',
          tbl_name
        )
      );
    end if;
  end loop;
end;
$$;

comment on function public.fn_auto_enable_rls() is
  'DDL event trigger: automatically enables RLS on any new public schema table '
  'and writes an audit record. Prevents accidental world-readable table creation.';

-- ── Attach event trigger ───────────────────────────────────────────────────
-- Drop first so the migration is idempotent on re-run.
-- Wrapped in DO block because event triggers require superuser privileges
-- which may not be available on Supabase preview branches.
do $$
begin
  drop event trigger if exists trg_auto_enable_rls;

  create event trigger trg_auto_enable_rls
    on ddl_command_end
    when tag in ('CREATE TABLE')
    execute function public.fn_auto_enable_rls();

  comment on event trigger trg_auto_enable_rls is
    'Fires after any CREATE TABLE and automatically enables RLS on the new table.';
exception
  when insufficient_privilege then
    raise notice 'Skipping event trigger — insufficient privileges (expected on preview branches).';
end;
$$;

-- ── Index for rls_audit queries ────────────────────────────────────────────
create index if not exists idx_rls_audit_created_at
  on public.rls_audit (created_at desc);

create index if not exists idx_rls_audit_table_action
  on public.rls_audit (table_name, action);
