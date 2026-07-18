-- Fix Supabase linter CRITICAL: security-definer view bypassing RLS.
-- public.sponsor_exposure_report_v2 (created in 20260508000100_shadow_event_core.sql)
-- executed with owner (postgres) privileges, exposing aggregated sponsor/campaign
-- metrics to any authenticated user despite sponsor_exposures RLS restricting
-- select to super_admin / league_admin / media_operator.
--
-- security_invoker=on makes the view enforce the CALLER's permissions and RLS.
-- Admin roles already pass sponsor_exposures_admin_read, so the report keeps
-- working for its intended audience; everyone else now gets zero rows.
-- No grants change, no data change. Rollback: set security_invoker = off.

alter view public.sponsor_exposure_report_v2 set (security_invoker = on);

-- Verification (run after):
-- select c.relname, c.reloptions
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'sponsor_exposure_report_v2';
-- Expect reloptions to include: security_invoker=on
