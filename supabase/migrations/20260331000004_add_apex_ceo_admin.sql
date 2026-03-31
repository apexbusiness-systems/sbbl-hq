-- ─────────────────────────────────────────────────────────────────────────────
-- Grant super_admin to additional APEX principals.
--
-- This migration exclusively writes to admin_email_grants — no UIDs are
-- referenced anywhere.  The trigger installed by 20260331000003_admin_bootstrap
-- handles all future sign-ups automatically; the backfill INSERT at the bottom
-- covers any accounts that already exist.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_email_grants (email, role, note)
VALUES
  ('jrmedozaceo@apexbusiness-systems.com', 'super_admin', 'APEX CEO / co-founder'),
  ('sgworks30@gmail.com',                  'super_admin', 'Founder / primary admin')
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role,
      note = EXCLUDED.note;

-- Backfill: grant super_admin to any of the above who already have an account
INSERT INTO public.user_role_assignments (user_id, role)
SELECT u.id, g.role::public.app_role
FROM   auth.users               u
JOIN   public.admin_email_grants g ON g.email = u.email
WHERE  g.email IN (
  'jrmedozaceo@apexbusiness-systems.com',
  'sgworks30@gmail.com'
)
ON CONFLICT DO NOTHING;
