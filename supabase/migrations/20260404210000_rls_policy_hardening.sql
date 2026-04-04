-- P2-B: RLS policy performance hardening
--
-- Two optimizations:
--
-- 1. (SELECT auth.uid()) pattern
--    The Postgres planner evaluates `auth.uid()` once per row in a plain
--    `user_id = auth.uid()` predicate. Wrapping in a scalar subquery
--    `user_id = (SELECT auth.uid())` marks it as a stable init-plan —
--    executed once per query, then cached. On a table with 100 K rows this
--    reduces auth function call overhead by ~100 K calls per query.
--
-- 2. SECURITY DEFINER membership helpers
--    Membership checks (is this user in league X? is this user on team Y?)
--    appear in dozens of RLS policies. Repeating the JOIN inline means the
--    planner re-plans it every time. A SECURITY DEFINER function with a
--    stable search_path is planned once and inlined as a function scan.
--
-- All existing policies that reference bare auth.uid() in their USING /
-- WITH CHECK clauses are recreated with the (SELECT auth.uid()) pattern.
-- Policies on tables that already use the pattern are left unchanged.
--
-- Note: we drop and recreate policies rather than ALTER because Postgres
-- does not support ALTER POLICY ... USING on all versions.

-- ── SECURITY DEFINER membership helpers ───────────────────────────────────

-- Helper: is the calling user a member of the given league?
create or replace function public.fn_user_in_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id  = (select auth.uid())
      and ura.league_id = p_league_id
  );
$$;

comment on function public.fn_user_in_league(uuid) is
  'Returns true if the authenticated user has any role assignment in the given league. '
  'SECURITY DEFINER + stable allows the planner to cache the result per query.';

-- Helper: is the calling user a member of the given team?
create or replace function public.fn_user_in_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.team_id = p_team_id
  );
$$;

comment on function public.fn_user_in_team(uuid) is
  'Returns true if the authenticated user is a member of the given team. '
  'SECURITY DEFINER + stable allows the planner to cache the result per query.';

-- Helper: does the calling user have any of the given roles?
-- Wraps the existing has_any_role() with the (SELECT auth.uid()) pattern.
create or replace function public.fn_has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = (select auth.uid())
      and ura.role    = any(p_roles)
  );
$$;

comment on function public.fn_has_any_role(public.app_role[]) is
  'Returns true if the authenticated user has any of the given app roles. '
  'Use this instead of has_any_role() in RLS policies for planner-cache efficiency.';

-- Helper: is the calling user an admin (super_admin or league_admin)?
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_has_any_role(array['super_admin', 'league_admin']::public.app_role[]);
$$;

comment on function public.fn_is_admin() is
  'Returns true if the authenticated user is a super_admin or league_admin.';

-- Helper: does the calling user own the given profile (user_id match)?
-- Used in self-service update policies.
create or replace function public.fn_is_own_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) = p_user_id;
$$;

comment on function public.fn_is_own_profile(uuid) is
  'Returns true if the authenticated user''s ID matches the given user_id column value.';

-- ── Indexes on RLS-filtered columns (additive — IF NOT EXISTS) ─────────────
-- These cover the columns referenced in the membership helper subqueries
-- and were NOT already covered by 20260404100000_performance_indexes_10k_concurrent.sql

-- user_role_assignments: (user_id, league_id) composite — used by fn_user_in_league
create index if not exists idx_ura_user_league
  on public.user_role_assignments (user_id, league_id);

-- user_role_assignments: (user_id, role) — used by fn_has_any_role
create index if not exists idx_ura_user_role_composite
  on public.user_role_assignments (user_id, role);

-- team_memberships: (user_id, team_id) — used by fn_user_in_team
create index if not exists idx_tm_user_team
  on public.team_memberships (user_id, team_id);

-- profiles: user_id (primary self-service lookup)
create index if not exists idx_profiles_uid_covering
  on public.profiles (user_id)
  include (subscription_ends_at, onboarding_completed_at);

-- ── Recreate hot-path RLS policies with (SELECT auth.uid()) ───────────────
-- Targeting only the highest-traffic tables: profiles, team_memberships,
-- billing_events, orders. Remaining tables follow the same pattern in the
-- next incremental migration.

-- profiles: self-service read/update
drop policy if exists "profiles_self_read"   on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;

create policy "profiles_self_read"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- team_memberships: member can read own rows; admins can read all
drop policy if exists "team_memberships_self_read"  on public.team_memberships;
drop policy if exists "team_memberships_admin_read" on public.team_memberships;

create policy "team_memberships_self_read"
  on public.team_memberships for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "team_memberships_admin_read"
  on public.team_memberships for select
  to authenticated
  using (public.fn_is_admin());

-- billing_events: users see own events; admins see all
drop policy if exists "billing_events_self_read"  on public.billing_events;
drop policy if exists "billing_events_admin_read" on public.billing_events;

create policy "billing_events_self_read"
  on public.billing_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "billing_events_admin_read"
  on public.billing_events for select
  to authenticated
  using (public.fn_is_admin());

-- orders: users see own orders; admins see all
drop policy if exists "orders_self_read"  on public.orders;
drop policy if exists "orders_admin_read" on public.orders;

create policy "orders_self_read"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "orders_admin_read"
  on public.orders for select
  to authenticated
  using (public.fn_is_admin());
