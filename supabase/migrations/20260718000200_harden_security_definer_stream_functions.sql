-- =============================================================================
-- MIGRATION: 20260718000200_harden_security_definer_stream_functions.sql
-- CONTRACT:  Stream Access Hardening — Task 2
-- PURPOSE:   Fix two Supabase security advisor findings:
--              1. SECURITY DEFINER functions with mutable search_path
--              2. Excessive execute grants to anon + authenticated roles
--
-- FUNCTIONS TARGETED (from supabase:get_advisors(security), project ezanilxygnpucwkwpsoc):
--   - public.cleanup_expired_stream_sessions()          [no-arg overload]
--   - public.cleanup_expired_stream_sessions(timestamptz) [timestamptz overload]
--   - public.expire_stream_access_sessions(text)
--
-- PRE-REVOKE SAFETY VERIFICATION (documented per contract §3/Task 2):
--   Worker grep for both function names against src/worker/index.ts → 0 results.
--   Neither function is called from any client-facing Worker RPC path.
--   Both are internal cleanup functions (scheduled job / cron context only).
--   Safe to revoke anon + authenticated execute access.
--
-- NOTE on search_path = '':
--   The empty string is more restrictive than the 'public, extensions, pg_temp' pattern
--   used in 20260404000300_harden_function_search_paths.sql. It is the Supabase advisor
--   recommendation for SECURITY DEFINER functions. These three functions reference only
--   public.stream_access_sessions with schema-qualified names — empty search_path is safe.
--
-- NOTE on existing function bodies:
--   cleanup_expired_stream_sessions (both overloads) defined in:
--     20260410120000_stream_validation_system.sql (already has set search_path = public)
--   expire_stream_access_sessions(text) defined in:
--     202603270001_core_schema.sql (no set search_path)
--   This migration overrides both to set search_path = '' (empty = most restrictive).
--
-- DOES NOT TOUCH:
--   No existing table, column, policy, index, or row is modified.
--   Function bodies are not changed — only configuration parameters + grants.
--   No existing migration is edited (Iron Law #9).
-- =============================================================================

-- ─── Pin search_path: cleanup_expired_stream_sessions() ──────────────────────
-- Overload 1: no-argument (called by scheduled cron, not client RPCs)
ALTER FUNCTION public.cleanup_expired_stream_sessions()
  SET search_path = '';

-- Overload 2: timestamptz argument (allows caller to override "now")
ALTER FUNCTION public.cleanup_expired_stream_sessions(timestamptz)
  SET search_path = '';

-- ─── Pin search_path: expire_stream_access_sessions(text) ───────────────────
-- Bulk-expire by idempotency_key. Internal cleanup path only.
ALTER FUNCTION public.expire_stream_access_sessions(text)
  SET search_path = '';

-- ─── Revoke broad execute grants ─────────────────────────────────────────────
-- These functions are only callable by the service-role (Worker / scheduled job).
-- Granting anon or authenticated execute on these cleanup functions is a privilege
-- escalation risk: a malicious authenticated user could expire all active sessions.

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stream_sessions()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stream_sessions(timestamptz)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_stream_access_sessions(text)
  FROM anon, authenticated;

-- =============================================================================
-- VERIFICATION QUERIES (run post-migration):
--
-- 1. Confirm search_path pinned to empty string:
--   SELECT proname, proconfig
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND proname IN (
--       'cleanup_expired_stream_sessions',
--       'expire_stream_access_sessions'
--     );
--   -- Expected: proconfig contains 'search_path=' for all three rows.
--
-- 2. Confirm execute revoked (no anon/authenticated in grantee):
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_schema = 'public'
--     AND routine_name IN (
--       'cleanup_expired_stream_sessions',
--       'expire_stream_access_sessions'
--     )
--     AND grantee IN ('anon', 'authenticated');
--   -- Expected: 0 rows.
--
-- 3. Re-run get_advisors(security) on project ezanilxygnpucwkwpsoc:
--   -- Expected: both function findings clear (no longer listed).
-- =============================================================================
