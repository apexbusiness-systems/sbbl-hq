-- Migration: add_fan_onboarding_and_subscription_helpers
-- Fixes: B4, B5
-- complete_fan_onboarding() — minimal fan profile upsert (NO bio, NO avatar_url).
--   Collects only: display_name (required), full_name (optional),
--   preferred_league (optional). Sets primary_role_intent='fan'.
-- is_premium_subscriber() — returns true when subscription_ends_at > now().

-- ── complete_fan_onboarding ─────────────────────────────────────────────────
-- NEVER sets bio or avatar_url — those are player/coach fields only.
-- Fully idempotent: safe to call multiple times.
CREATE OR REPLACE FUNCTION public.complete_fan_onboarding(
  p_display_name     text,
  p_full_name        text DEFAULT NULL,
  p_preferred_league text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'display_name_required');
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, full_name, preferred_league,
    primary_role_intent, onboarding_completed_at,
    created_by, updated_by
  )
  VALUES (
    v_user_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(coalesce(p_preferred_league, '')), ''),
    'fan',
    now(),
    v_user_id, v_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name            = trim(EXCLUDED.display_name),
        full_name               = COALESCE(EXCLUDED.full_name,        profiles.full_name),
        preferred_league        = COALESCE(EXCLUDED.preferred_league, profiles.preferred_league),
        primary_role_intent     = 'fan',
        onboarding_completed_at = COALESCE(profiles.onboarding_completed_at, now()),
        updated_by              = v_user_id,
        updated_at              = now();
  -- bio and avatar_url are deliberately never touched in this function

  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_fan_onboarding(text, text, text)
  TO authenticated;


-- ── is_premium_subscriber ───────────────────────────────────────────────────
-- Returns true when the given user (defaults to auth.uid()) has an active
-- subscription (subscription_ends_at > now()).
CREATE OR REPLACE FUNCTION public.is_premium_subscriber(
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid        := coalesce(p_user_id, auth.uid());
  v_ends_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;

  SELECT subscription_ends_at INTO v_ends_at
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  RETURN (v_ends_at IS NOT NULL AND v_ends_at > now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_premium_subscriber(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_premium_subscriber(uuid) TO anon;
