-- =============================================================================
-- Migration: player subscription model + coach approval flow
-- =============================================================================

-- Track when a user has completed onboarding (permanent flag, never cleared)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Stripe customer/subscription tracking for player membership
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Coach approval requests (submitted during onboarding)
CREATE TABLE IF NOT EXISTS coach_approval_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  preferred_league  TEXT,
  note              TEXT,
  reviewed_by       UUID REFERENCES auth.users(id),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active (pending) request per user
CREATE UNIQUE INDEX IF NOT EXISTS coach_approval_requests_user_pending_uniq
  ON coach_approval_requests (user_id)
  WHERE status = 'pending';

-- RLS
ALTER TABLE coach_approval_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "coach_requests_self_select" ON coach_approval_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pending request
CREATE POLICY "coach_requests_self_insert" ON coach_approval_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all requests
CREATE POLICY "coach_requests_admin_select" ON coach_approval_requests
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['league_admin', 'super_admin']));

-- Admins can update (approve/reject)
CREATE POLICY "coach_requests_admin_update" ON coach_approval_requests
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['league_admin', 'super_admin']));
