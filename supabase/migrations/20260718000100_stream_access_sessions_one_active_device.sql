-- =============================================================================
-- MIGRATION: 20260718000100_stream_access_sessions_one_active_device.sql
-- CONTRACT:  Stream Access Hardening — Task 1
-- PURPOSE:   Enforce one-active-device-per-user-per-game at the database layer.
--            Without this, two concurrent acquire calls with distinct idempotency
--            keys for the same (user_id, game_id) can both land status = 'active'.
--
-- TASK 0 EVIDENCE:
--   Canonical active-session column is `status` (not `session_status`).
--   Confirmed via migration archaeology:
--     - batch_heartbeat_upsert (20260406000100 + 20260515000100) writes status='active'/'ended'
--     - Existing partial indexes on status='active' confirm hot-path column
--     - Worker RPC guard is: status != 'displaced' (not session_status)
--
-- SAFETY:
--   - CONCURRENTLY: no table lock; safe on the live DB (0 rows in production, 2026-07-17)
--   - IF NOT EXISTS: fully idempotent — re-runnable with no error
--   - Two separate indexes: PPV games (game_id IS NOT NULL) + broadcast (game_id IS NULL)
--     Avoids PostgreSQL 14/15 NULLS NOT DISTINCT version dependency in self-hosted stack.
--
-- INVARIANT ENFORCED:
--   At most ONE row per (user_id, game_id) may have status = 'active' at any moment.
--   Concurrent acquire with a different idempotency_key will receive a unique_violation
--   (23505), which the Worker handler MUST catch and return a structured takeover response.
--
-- DOES NOT TOUCH:
--   No existing column, constraint, policy, or index is modified.
--   No existing migration is edited (Iron Law #9).
-- =============================================================================

-- Index 1: PPV game sessions (game_id IS NOT NULL)
-- Ensures at most one active session per user per game.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uq_stream_access_sessions_one_active_device
  ON public.stream_access_sessions (user_id, game_id)
  WHERE status = 'active'
    AND game_id IS NOT NULL;

-- Index 2: Broadcast sessions (game_id IS NULL — the 'broadcast' alias path)
-- Ensures at most one active broadcast session per user.
-- Separate index required because NULL != NULL in standard btree equality,
-- so (user_id, game_id) WHERE game_id IS NULL requires a (user_id)-only key.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uq_stream_access_sessions_one_active_broadcast
  ON public.stream_access_sessions (user_id)
  WHERE status = 'active'
    AND game_id IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES (run post-migration to confirm index creation):
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'stream_access_sessions'
--     AND indexname IN (
--       'uq_stream_access_sessions_one_active_device',
--       'uq_stream_access_sessions_one_active_broadcast'
--     );
--   -- Expected: 2 rows, both present.
--
-- CONCURRENCY ACCEPTANCE TEST (run in separate transactions):
--   -- Tx 1 + Tx 2 both execute simultaneously:
--   INSERT INTO public.stream_access_sessions
--     (entitlement_id, user_id, game_id, expires_at, idempotency_key, status)
--   VALUES
--     ('<ent_id>', '<user_id>', '<game_id>', now() + interval '2 hours',
--      'key-tx-<N>', 'active');
--   -- Expected: exactly one INSERT succeeds; the other raises 23505 unique_violation.
--
-- EXPLAIN CHECK (confirm index used on acquire path, no seq scan):
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT id FROM public.stream_access_sessions
--   WHERE user_id = '<user_id>'::uuid
--     AND game_id = '<game_id>'::uuid
--     AND status = 'active';
--   -- Expected: Index Scan on uq_stream_access_sessions_one_active_device
-- =============================================================================
