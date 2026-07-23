-- ─────────────────────────────────────────────────────────────────────────────
-- Grant regular admin (league_admin) status to rondalesteve@gmail.com.
-- Explicitly revokes super_admin role if previously assigned.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_email_grants (email, role, note)
VALUES ('rondalesteve@gmail.com', 'league_admin', 'Regular admin grant')
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role,
      note = EXCLUDED.note;

-- Revoke super_admin if it exists for this user in auth.users
DELETE FROM public.user_role_assignments
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'rondalesteve@gmail.com'
)
AND role = 'super_admin';

-- Targeted backfill: grant league_admin to the user if they already exist in auth.users
INSERT INTO public.user_role_assignments (user_id, role)
SELECT u.id, 'league_admin'::public.app_role
FROM   auth.users u
WHERE  u.email = 'rondalesteve@gmail.com'
  AND  NOT EXISTS (
    SELECT 1 FROM public.user_role_assignments r
    WHERE r.user_id = u.id AND r.role = 'league_admin'
  );
