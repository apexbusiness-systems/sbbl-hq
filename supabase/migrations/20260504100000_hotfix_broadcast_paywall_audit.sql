-- Migration: hotfix_broadcast_paywall_audit
-- Post-merge hotfix for two latent bugs in PR #461 (merged 2026-05-04):
--
-- BUG 1 (HIGH): get_active_broadcast() called can_user_view_stream with the
-- arguments in the WRONG order. The published can_user_view_stream signature
-- is (p_game_id text, p_user_id uuid) per migration 20260402120000, but
-- get_active_broadcast passed (uuid, text). This would raise
-- "function ... does not exist" the first time an admin set
-- stream_admin_config.active_game_id to a non-NULL UUID — silently denying
-- access to every PPV/code-redeemed user for that game.
--
-- BUG 2 (HIGH): redeem_ppv_invite() always cast v_invite.game_id::uuid before
-- calling create_stream_entitlement. ppv_invites.game_id is TEXT (per
-- migration 20260402120000) and the open-broadcast comp-code flow stores the
-- literal string 'broadcast' there (per Live.tsx handleGenerateCompCode
-- fallback). Casting 'broadcast'::uuid throws invalid_text_representation,
-- aborting the redemption transaction — the user sees a generic error and the
-- invite is never marked used.
--
-- Both functions are rebuilt CREATE OR REPLACE; signatures unchanged.

-- ── Fix 1: get_active_broadcast — correct can_user_view_stream arg order ────
-- Use NAMED arguments so future signature changes can't silently re-introduce
-- the same positional bug.
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
      -- FIXED: named-arg call. Signature is (p_game_id text, p_user_id uuid).
      v_has_entitlement := public.can_user_view_stream(
        p_game_id => v_config.active_game_id::text,
        p_user_id => v_user_id
      );
    ELSE
      -- Open broadcast (no game bound): registered users have free access.
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


-- ── Fix 2: redeem_ppv_invite — handle non-UUID game_id (open-broadcast) ────
-- Detect the open-broadcast sentinel ('broadcast') and any other non-UUID
-- value before casting. For non-UUID codes:
--   * mark the invite consumed (so it can't be reused)
--   * skip create_stream_entitlement (entitlements require uuid game_id)
--   * return ok=true with status='open_broadcast'
-- Open-broadcast access is granted via get_active_broadcast's registered-user
-- branch (no entitlement row required), so the redeemer still gets in once
-- their profile is onboarded.
CREATE OR REPLACE FUNCTION public.redeem_ppv_invite(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite          RECORD;
  v_user_id         uuid := auth.uid();
  v_result          jsonb;
  v_ip              text := 'unknown';
  v_raw_headers     text;
  v_headers_json    jsonb;
  v_game_uuid       uuid;
  v_is_uuid_game_id boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite
  FROM public.ppv_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    IF v_invite.used_by = v_user_id THEN
      RETURN jsonb_build_object(
        'ok', true, 'status', 'already_redeemed',
        'game_id', v_invite.game_id
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'code_already_used');
  END IF;

  -- Safely extract client IP from request headers.
  BEGIN
    v_raw_headers := current_setting('request.headers', true);
    IF v_raw_headers IS NOT NULL AND v_raw_headers <> '' THEN
      v_headers_json := v_raw_headers::jsonb;
      v_ip := coalesce(
        nullif(trim(v_headers_json ->> 'x-forwarded-for'), ''),
        nullif(trim(v_headers_json ->> 'x-real-ip'),       ''),
        'unknown'
      );
    END IF;
  EXCEPTION WHEN others THEN
    v_ip := 'unknown';
  END;

  UPDATE public.ppv_invites
  SET
    used_by    = v_user_id,
    used_at    = now(),
    ip_address = v_ip
  WHERE id = v_invite.id;

  -- Detect whether game_id is a real UUID (game-bound) or a sentinel string
  -- like 'broadcast' (open-broadcast comp code). Only game-bound codes get a
  -- stream_entitlements row; open-broadcast codes are gated by registration
  -- in get_active_broadcast's open-broadcast branch.
  v_is_uuid_game_id := false;
  BEGIN
    v_game_uuid := v_invite.game_id::uuid;
    v_is_uuid_game_id := true;
  EXCEPTION WHEN others THEN
    v_is_uuid_game_id := false;
  END;

  IF v_is_uuid_game_id THEN
    SELECT public.create_stream_entitlement(
      v_game_uuid,
      v_user_id,
      NULL,
      v_invite.expires_at,
      'ppv_invite_' || v_invite.id::text
    ) INTO v_result;

    RETURN jsonb_build_object(
      'ok',          true,
      'status',      'redeemed',
      'game_id',     v_invite.game_id,
      'entitlement', v_result
    );
  ELSE
    -- Open-broadcast comp code. No entitlement row needed — get_active_broadcast
    -- grants open-broadcast access to any registered user. Mark the code used
    -- so it can't be re-redeemed by another user.
    RETURN jsonb_build_object(
      'ok',      true,
      'status',  'open_broadcast',
      'game_id', v_invite.game_id,
      'note',    'open_broadcast_access_granted_via_registration'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_ppv_invite(text) TO authenticated;
