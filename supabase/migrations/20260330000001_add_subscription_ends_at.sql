-- Add subscription_ends_at to profiles table
-- Used by AppContext to determine active player tier without relying on localStorage.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS profiles_subscription_ends_at_idx
  ON profiles (user_id, subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;

-- Allow the service role (worker) to update this column via Stripe webhook
-- Row-level security: users can read their own subscription_ends_at;
-- only service role can write it (via worker webhook handler).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "service_role_write_profile"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');
