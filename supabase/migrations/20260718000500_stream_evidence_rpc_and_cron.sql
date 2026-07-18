-- =============================================================================
-- MIGRATION: 20260718000500_stream_evidence_rpc_and_cron.sql
-- CONTRACT:  Stream Access Hardening — Tasks 3 & 4
--
-- PURPOSE:
--   1. Task 3: Create the record_evidence_event(jsonb) RPC as the strict, 
--      append-only write path for public.stream_evidence_events.
--   2. Task 4: Fix cleanup_stream_access_sessions cron interval.
--      Changed from '*/5 * * * *' (5 minutes) to '* * * * *' (1 minute).
--      Because the worker writes expiresAt = now + 70s, a 5-minute cleanup
--      leaves expired sessions active too long, causing brief network
--      disconnects to trigger full device displacement. 1-minute cleanup
--      tightens this window to the heartbeat threshold.
--
-- DO NOT TOUCH:
--   No existing tables or functions dropped.
-- =============================================================================

-- ─── Task 3: Evidence Ledger RPC ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_evidence_event(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_game_id uuid;
  v_category text;
  v_event_type text;
  v_idempotency_key text;
  v_actor_id uuid;
BEGIN
  -- Strict parsing
  v_game_id := (p_payload->>'game_id')::uuid;
  v_category := p_payload->>'category';
  v_event_type := p_payload->>'event_type';
  v_idempotency_key := p_payload->>'idempotency_key';
  
  -- The calling user is explicitly extracted from auth.uid(), circumventing
  -- any client spoofing of the actor_id.
  v_actor_id := auth.uid();

  -- Required fields check
  IF v_game_id IS NULL OR v_category IS NULL OR v_event_type IS NULL THEN
    RAISE EXCEPTION 'game_id, category, and event_type are required';
  END IF;

  INSERT INTO public.stream_evidence_events (
    game_id,
    stream_session_id,
    stream_access_session_id,
    entitlement_id,
    actor_id,
    correlation_id,
    idempotency_key,
    category,
    event_type,
    severity,
    outcome,
    attributes
  )
  VALUES (
    v_game_id,
    (p_payload->>'stream_session_id')::uuid,
    (p_payload->>'stream_access_session_id')::uuid,
    (p_payload->>'entitlement_id')::uuid,
    v_actor_id,
    COALESCE((p_payload->>'correlation_id')::uuid, gen_random_uuid()),
    v_idempotency_key,
    v_category,
    v_event_type,
    COALESCE(p_payload->>'severity', 'info'),
    p_payload->>'outcome',
    COALESCE(p_payload->'attributes', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Enforce zero-trust
REVOKE ALL ON FUNCTION public.record_evidence_event(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_evidence_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_evidence_event(jsonb) TO service_role;

-- ─── Task 4: Cleanup Cron Interval ───────────────────────────────────────────

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id 
  FROM cron.job 
  WHERE jobname = 'cleanup-stream-sessions';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := v_job_id,
      schedule := '* * * * *'
    );
  END IF;
END;
$$;
