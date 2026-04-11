-- ─────────────────────────────────────────────────────────────────────────────
-- Grant super_admin to sbblhqapp@gmail.com via the email-driven bootstrap.
--
-- This reuses the admin_email_grants pattern established in
-- 20260331000003_admin_bootstrap.sql — no hardcoded UIDs, no hardcoded
-- credentials, and the assignment survives password resets and account
-- recovery because it's keyed to the verified email in auth.users.
--
-- Behavior:
--   1. Insert the email → super_admin mapping (idempotent via ON CONFLICT).
--   2. If the user already exists in auth.users, the targeted backfill
--      grants the role immediately without waiting for a re-signup.
--   3. If the user signs up later (or re-signs up after account deletion),
--      the trg_auto_grant_role_on_signup trigger from the original bootstrap
--      migration picks up the new auth.users row and inserts the role
--      automatically.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_email_grants (email, role, note)
VALUES ('sbblhqapp@gmail.com', 'super_admin', 'SBBL HQ application super admin')
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role,
      note = EXCLUDED.note;

-- Targeted backfill: if the auth user already exists, grant the role now.
-- This matches the tail of the original bootstrap migration but is scoped
-- to just this email so re-running is cheap.
INSERT INTO public.user_role_assignments (user_id, role)
SELECT u.id, g.role::public.app_role
FROM   auth.users                u
JOIN   public.admin_email_grants g ON g.email = u.email
WHERE  g.email = 'sbblhqapp@gmail.com'
ON CONFLICT DO NOTHING;
