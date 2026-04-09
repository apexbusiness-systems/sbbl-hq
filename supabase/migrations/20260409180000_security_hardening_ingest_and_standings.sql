-- Security hardening: resolve Supabase linter findings
-- 1) ingest_jobs has RLS enabled but must always have an explicit policy baseline.
-- 2) mvw_standings should not be directly selectable by anon/authenticated Data API roles.

-- ── ingest_jobs: enforce explicit super-admin RLS policy ────────────────────
alter table if exists public.ingest_jobs enable row level security;

drop policy if exists "ingest_jobs_super_admin" on public.ingest_jobs;
create policy "ingest_jobs_super_admin"
  on public.ingest_jobs
  as permissive
  for all
  to authenticated
  using ((auth.jwt() ->> 'role') = 'super_admin')
  with check ((auth.jwt() ->> 'role') = 'super_admin');

-- ── mvw_standings: remove Data API exposure for anon/authenticated ─────────
revoke all on public.mvw_standings from anon, authenticated;
grant select on public.mvw_standings to service_role;
