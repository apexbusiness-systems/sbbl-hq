-- Migration: fix_entitlement_status_mismatch
-- Fixes: B1 — create_stream_entitlement() inserted status='purchased'
-- but can_user_view_stream() checks status='active'. Every PPV purchase
-- was silently rejected. Fix applied on the INSERT side only.
-- can_user_view_stream() is NOT touched.

-- Step 1: Ensure 'active' exists in entitlement_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'entitlement_status'
      AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE public.entitlement_status ADD VALUE 'active';
  END IF;
END $$;

-- Step 2: Rebuild create_stream_entitlement inserting status='active'
CREATE OR REPLACE FUNCTION public.create_stream_entitlement(
  p_game_id         uuid,
  p_user_id         uuid,
  p_order_id        uuid        DEFAULT NULL,
  p_expires_at      timestamptz DEFAULT NULL,
  p_idempotency_key text        DEFAULT gen_random_uuid()::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.enforce_idempotency(p_idempotency_key);
  INSERT INTO public.stream_entitlements(
    game_id, user_id, order_id, status, expires_at,
    idempotency_key, created_by, updated_by
  )
  VALUES (
    p_game_id, p_user_id, p_order_id,
    'active',   -- FIXED: was 'purchased' — must match can_user_view_stream check
    p_expires_at, p_idempotency_key, auth.uid(), auth.uid()
  )
  ON CONFLICT (game_id, user_id, idempotency_key)
  DO UPDATE SET status = 'active', updated_by = auth.uid()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entitlement_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.create_stream_entitlement(uuid, uuid, uuid, timestamptz, text)
  TO authenticated;
