-- Follow-up security hardening:
-- 1) Use repo-standard role helper for ingest_jobs super-admin policy checks.
-- 2) Ensure mvw_standings is not selectable by API-facing roles/public.

alter table if exists public.ingest_jobs enable row level security;

drop policy if exists "ingest_jobs_super_admin" on public.ingest_jobs;
create policy "ingest_jobs_super_admin"
  on public.ingest_jobs
  as permissive
  for all
  to authenticated
  using (public.fn_has_any_role(array['super_admin']::public.app_role[]))
  with check (public.fn_has_any_role(array['super_admin']::public.app_role[]));

revoke all on public.mvw_standings from public;
revoke all on public.mvw_standings from anon;
revoke all on public.mvw_standings from authenticated;
grant select on public.mvw_standings to service_role;
