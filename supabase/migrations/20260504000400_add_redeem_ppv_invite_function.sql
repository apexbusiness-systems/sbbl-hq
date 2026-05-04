-- Migration: add_redeem_ppv_invite_function
-- Fixes: B3, B6 — no redeem_ppv_invite() function existed, and ppv_invites
-- RLS blocked authenticated reads. This SECURITY DEFINER function bypasses RLS
-- for the lookup, validates the code, marks the invite used, and calls
-- create_stream_entitlement() to grant the entitlement. Idempotent: re-redemption
-- by the same user returns ok=true without error.

CREATE OR REPLACE FUNCTION public.redeem_ppv_invite(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite         RECORD;
  v_user_id        uuid := auth.uid();
  v_result         jsonb;
  v_ip             text := 'unknown';
  v_raw_headers    text;
  v_headers_json   jsonb;
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
  -- Falls back to 'unknown' if headers are absent, empty, or non-JSON.
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

  SELECT public.create_stream_entitlement(
    v_invite.game_id::uuid,
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_ppv_invite(text) TO authenticated;
