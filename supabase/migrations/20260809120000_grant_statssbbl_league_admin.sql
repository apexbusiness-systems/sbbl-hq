-- ─────────────────────────────────────────────────────────────────────────────
-- Grant REGULAR admin (league_admin) status to statssbbl@gmail.com.
--
-- Deliberately NOT super_admin. This account is the league stats operator and
-- must not hold level-5 privileges (broadcast control panel, stream_admin_config
-- collection_id reads, secret-bearing surfaces). See CLAUDE.md §7.1 — super_admin
-- is the only role permitted to read stream_admin_config.collection_id directly.
--
-- Mirrors the pattern established in:
--   20260331000003_admin_bootstrap.sql          (email-driven grants + trigger)
--   20260722180000_grant_rondalesteve_league_admin.sql (regular-admin precedent)
--
-- Behavior:
--   1. Upsert the email → league_admin mapping. The UPDATE branch is what
--      downgrades the account if it was previously mapped to super_admin.
--   2. Revoke any existing super_admin assignment in user_role_assignments.
--   3. Targeted backfill so an already-registered user is upgraded immediately
--      instead of waiting for a re-signup.
--   4. If the user signs up later, trg_auto_grant_role_on_signup picks up the
--      admin_email_grants row and inserts league_admin automatically.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_email_grants (email, role, note)
VALUES ('statssbbl@gmail.com', 'league_admin', 'Regular admin grant — league stats operator (NOT super admin)')
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role,
      note = EXCLUDED.note;

-- Revoke super_admin if it was previously assigned to this account.
-- Runs before the league_admin backfill so a downgrade is never a no-op.
DELETE FROM public.user_role_assignments
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'statssbbl@gmail.com'
)
AND role = 'super_admin';

-- Targeted backfill: grant league_admin now if the auth user already exists.
INSERT INTO public.user_role_assignments (user_id, role)
SELECT u.id, 'league_admin'::public.app_role
FROM   auth.users u
WHERE  lower(u.email) = 'statssbbl@gmail.com'
  AND  NOT EXISTS (
    SELECT 1 FROM public.user_role_assignments r
    WHERE r.user_id = u.id AND r.role = 'league_admin'
  );
