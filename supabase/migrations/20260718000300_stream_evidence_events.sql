-- =============================================================================
-- MIGRATION: 20260718000300_stream_evidence_events.sql
-- CONTRACT:  Stream Access Hardening — Task 3
-- STATUS:    ⚠️  PENDING JR APPROVAL — DO NOT APPLY UNTIL EXPLICITLY APPROVED
--            Per contract §6: confirm Task 3 scope before writing RPC layer.
--            Deploy in a SEPARATE PR from Tasks 1–2.
--
-- PURPOSE:   Unified, append-only playback evidence ledger for:
--              - Client-side playback SLI events (PLAY_ATTEMPT, FIRST_FRAME, etc.)
--              - Lease/token lifecycle events (LEASE_ACQUIRED, TOKEN_ISSUED, etc.)
--              - Access gate decisions (ENTITLEMENT_ALLOWED, ENTITLEMENT_DENIED)
--
-- NAMING:    stream_evidence_events (NOT broadcast_* — broadcast_markers already
--            exists and means in-game highlight timestamps; do not collide).
--
-- ACTOR_ID:  Named actor_id (not user_id) to avoid ambiguity — this table
--            joins against stream_entitlements.user_id, stream_access_sessions.user_id,
--            and potentially a service-level actor (null for server-initiated events).
--
-- APPEND-ONLY ENFORCEMENT:
--   REVOKE UPDATE, DELETE from anon + authenticated at grant level.
--   Service-role (Worker) retains INSERT only.
--
-- RLS PATTERN:
--   Copied verbatim from stream_entitlements "read own row" pattern
--   (confirmed from 202603270001_core_schema.sql: stream_entitlements has
--    user_id = auth.uid() SELECT policy). Substituted actor_id for user_id.
--
-- DOES NOT TOUCH:
--   No existing table, column, policy, index, constraint, or function.
--   game_event_ledger, stream_watermark_events, validation_runs — untouched.
--   No existing migration is edited (Iron Law #9).
-- =============================================================================

-- ─── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stream_evidence_events (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core linkage (all FKs nullable — evidence row must outlive the thing it references)
  game_id                 uuid        NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  stream_session_id       uuid        NULL     REFERENCES public.stream_sessions(id) ON DELETE SET NULL,
  stream_access_session_id uuid       NULL     REFERENCES public.stream_access_sessions(id) ON DELETE SET NULL,
  entitlement_id          uuid        NULL     REFERENCES public.stream_entitlements(id) ON DELETE SET NULL,
  actor_id                uuid        NULL     REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Correlation + idempotency
  correlation_id          uuid        NOT NULL,
  idempotency_key         text        NULL,         -- nullable: server-generated events may not have one

  -- Event classification
  category                text        NOT NULL CHECK (category IN (
    'access', 'lease', 'token', 'playback', 'quality', 'recovery'
  )),
  event_type              text        NOT NULL CHECK (event_type IN (
    'ENTITLEMENT_ALLOWED', 'ENTITLEMENT_DENIED',
    'LEASE_ACQUIRED',      'LEASE_TAKEOVER',    'LEASE_REVOKED',
    'TOKEN_ISSUED',        'TOKEN_DENIED',
    'PLAY_ATTEMPT',        'FIRST_FRAME',
    'REBUFFER_STARTED',    'REBUFFER_ENDED',
    'FATAL_ERROR',         'BACKUP_ACTIVATED',  'RECOVERED'
  )),
  severity                text        NOT NULL DEFAULT 'info' CHECK (severity IN (
    'debug', 'info', 'warning', 'error', 'critical'
  )),
  outcome                 text        NULL     CHECK (outcome IN (
    'success', 'denied', 'failed', 'degraded'
  )),

  -- Freeform payload (client-reported metrics, error codes, provider info)
  attributes              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Validation run linkage (for evidence-chain queries across validation_runs)
  validation_run_id       uuid        NULL,   -- intentionally no FK — validation_runs may be purged

  -- Timestamps
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (Iron Law #6 — DDL trigger will enforce this, but be explicit)
ALTER TABLE public.stream_evidence_events ENABLE ROW LEVEL SECURITY;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Idempotency guard: prevent duplicate client submissions for the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_stream_evidence_idempotency_key
  ON public.stream_evidence_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Primary time-series access pattern: events by game in reverse chronological order
CREATE INDEX IF NOT EXISTS idx_stream_evidence_game_time
  ON public.stream_evidence_events (game_id, occurred_at DESC);

-- SLI playback metrics: fast aggregation for TTFF + rebuffer + error rates per game
CREATE INDEX IF NOT EXISTS idx_stream_evidence_playback_sli
  ON public.stream_evidence_events (game_id, event_type, occurred_at)
  WHERE category = 'playback'
    AND event_type IN ('PLAY_ATTEMPT', 'FIRST_FRAME', 'FATAL_ERROR');

-- ─── RLS Policies ────────────────────────────────────────────────────────────
-- Pattern: copied from stream_entitlements "read own row" convention
-- (stream_entitlements SELECT policy: user_id = auth.uid())
-- Substituted: actor_id for user_id.

DROP POLICY IF EXISTS "stream_evidence_events_read_own" ON public.stream_evidence_events;
CREATE POLICY "stream_evidence_events_read_own"
  ON public.stream_evidence_events
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

-- Service-role reads all (no RLS restriction for service-role by default)
-- No super_admin read policy needed — service-role bypasses RLS.

-- ─── Append-only enforcement ──────────────────────────────────────────────────
-- Evidence rows must never be updated or deleted by client roles.
-- Service-role (Worker INSERT path) is not affected by REVOKE.
REVOKE UPDATE, DELETE ON public.stream_evidence_events FROM anon, authenticated;

-- =============================================================================
-- VERIFICATION QUERIES (run post-migration):
--
-- 1. Confirm table created with all columns:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'stream_evidence_events'
--   ORDER BY ordinal_position;
--
-- 2. Confirm indexes:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'stream_evidence_events';
--   -- Expected: 3 rows (idempotency_key, game_time, playback_sli)
--
-- 3. Confirm RLS enabled:
--   SELECT relrowsecurity FROM pg_class
--   WHERE relname = 'stream_evidence_events';
--   -- Expected: true
--
-- 4. Confirm revoke:
--   SELECT grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_name = 'stream_evidence_events'
--     AND grantee IN ('anon', 'authenticated')
--     AND privilege_type IN ('UPDATE', 'DELETE');
--   -- Expected: 0 rows
--
-- NEXT STEP (requires JR approval):
--   Write record_evidence_event(jsonb) RPC — the sole write path to this table.
--   Function must: enforce idempotency_key, validate category/event_type enum,
--   check auth.uid() for actor_id, INSERT only. SECURITY DEFINER + set search_path = ''.
-- =============================================================================
