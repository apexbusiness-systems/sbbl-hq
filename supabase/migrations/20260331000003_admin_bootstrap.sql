-- ─────────────────────────────────────────────────────────────────────────────
-- Admin bootstrap: email-driven role grants (no hardcoded UIDs)
--
-- How it works:
--   1. `admin_email_grants` holds the list of emails that should receive admin.
--      Add more rows here (or via SQL) to grant additional admins — no code
--      changes or UID lookups required.
--   2. A trigger on auth.users fires on every new sign-up; if the email is in
--      the grants table the admin role is inserted automatically.
--   3. A backfill INSERT runs immediately so existing users are upgraded now.
-- ─────────────────────────────────────────────────────────────────────────────

-- Table: stores bootstrap email → role mappings
CREATE TABLE IF NOT EXISTS public.admin_email_grants (
  email TEXT PRIMARY KEY,
  role  TEXT NOT NULL DEFAULT 'admin',
  note  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: grant super_admin to this email (level 5 — satisfies all role checks)
INSERT INTO public.admin_email_grants (email, role, note)
VALUES ('sgworks30@gmail.com', 'super_admin', 'Founder / primary admin')
ON CONFLICT (email) DO NOTHING;

-- Function: called by trigger on each new auth.users row
CREATE OR REPLACE FUNCTION public.auto_grant_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_role_assignments (user_id, role)
  SELECT NEW.id, g.role::public.app_role
  FROM   public.admin_email_grants g
  WHERE  g.email = NEW.email
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: fires after every new user is created in auth.users
DROP TRIGGER IF EXISTS trg_auto_grant_role_on_signup ON auth.users;
CREATE TRIGGER trg_auto_grant_role_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_role_on_signup();

-- Backfill: grant role to any existing users whose email is in the table
INSERT INTO public.user_role_assignments (user_id, role)
SELECT u.id, g.role::public.app_role
FROM   auth.users               u
JOIN   public.admin_email_grants g ON g.email = u.email
ON CONFLICT DO NOTHING;
