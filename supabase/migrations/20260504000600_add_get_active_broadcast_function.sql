-- Migration: add_get_active_broadcast_function
-- Fixes: A3, A4, A5, A6 — unified broadcast oracle with paywall signals.
-- This is the SINGLE RPC the frontend calls. All access state is resolved
-- server-side. stream_url is WITHHELD unless the user is permitted — enforced
-- entirely within this function. No client-side-only guard is sufficient.
--
-- Return shape:
--   is_live          boolean
--   stream_url       text|null   — populated ONLY when user may watch
--   title            text
--   active_game_id   uuid|null
--   live_started_at  timestamptz|null
--   requires_payment boolean     — show paywall (registered user, no access)
--   is_subscribed    boolean     — premium subscriber
--   has_entitlement  boolean     — paid PPV or code-redeemed
--   user_registered  boolean     — authenticated + onboarding complete

CREATE OR REPLACE FUNCTION public.get_active_broadcast()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config          RECORD;
  v_user_id         uuid        := auth.uid();
  v_is_subscribed   boolean     := false;
  v_has_entitlement boolean     := false;
  v_can_watch       boolean     := false;
  v_registered      boolean     := false;
BEGIN
  SELECT id, collection_id, title, source, is_live,
         active_game_id, live_started_at
  INTO v_config
  FROM public.stream_admin_config
  WHERE id = true
  LIMIT 1;

  IF v_config IS NULL OR v_config.is_live = false THEN
    RETURN jsonb_build_object(
      'is_live',          false,
      'stream_url',       null,
      'title',            null,
      'active_game_id',   null,
      'live_started_at',  null,
      'requires_payment', false,
      'is_subscribed',    false,
      'has_entitlement',  false,
      'user_registered',  false
    );
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = v_user_id
        AND onboarding_completed_at IS NOT NULL
    ) INTO v_registered;

    v_is_subscribed := public.is_premium_subscriber(v_user_id);

    IF v_config.active_game_id IS NOT NULL THEN
      v_has_entitlement := public.can_user_view_stream(
        v_user_id,
        v_config.active_game_id::text
      );
    ELSE
      -- No game_id = open broadcast: all registered users may watch freely
      v_has_entitlement := v_registered;
    END IF;

    v_can_watch := v_is_subscribed OR v_has_entitlement;
  END IF;

  RETURN jsonb_build_object(
    'is_live',          true,
    'stream_url',       CASE WHEN v_can_watch THEN v_config.collection_id ELSE null END,
    'title',            v_config.title,
    'active_game_id',   v_config.active_game_id,
    'live_started_at',  v_config.live_started_at,
    'requires_payment', (NOT v_can_watch AND v_user_id IS NOT NULL AND v_registered),
    'is_subscribed',    v_is_subscribed,
    'has_entitlement',  v_has_entitlement,
    'user_registered',  v_registered
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_broadcast() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_broadcast() TO anon;
