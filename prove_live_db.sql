-- DB Verification Script for Production (Stream Access Hardening)
-- Proves partial indexes enforce uniqueness on untied broadcasts and PPV games.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_game_id uuid := '00000000-0000-0000-0000-000000000002';
  v_session_id uuid;
BEGIN
  -- 1. Untied Broadcast (game_id IS NULL)
  INSERT INTO stream_access_sessions (user_id, game_id, status, idempotency_key, created_by, updated_by)
  VALUES (v_user_id, NULL, 'active', 'broadcast-1', v_user_id, v_user_id);
  RAISE NOTICE 'SUCCESS: First untied broadcast session created.';

  BEGIN
    INSERT INTO stream_access_sessions (user_id, game_id, status, idempotency_key, created_by, updated_by)
    VALUES (v_user_id, NULL, 'active', 'broadcast-2', v_user_id, v_user_id);
    RAISE EXCEPTION 'FAILED: Second untied broadcast session was allowed! Index failed.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Second untied broadcast session correctly DENIED (unique_violation).';
  END;

  -- 2. PPV Game (game_id IS NOT NULL)
  INSERT INTO stream_access_sessions (user_id, game_id, status, idempotency_key, created_by, updated_by)
  VALUES (v_user_id, v_game_id, 'active', 'ppv-1', v_user_id, v_user_id);
  RAISE NOTICE 'SUCCESS: First PPV game session created.';

  BEGIN
    INSERT INTO stream_access_sessions (user_id, game_id, status, idempotency_key, created_by, updated_by)
    VALUES (v_user_id, v_game_id, 'active', 'ppv-2', v_user_id, v_user_id);
    RAISE EXCEPTION 'FAILED: Second PPV game session was allowed! Index failed.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Second PPV game session correctly DENIED (unique_violation).';
  END;
END;
$$;

ROLLBACK;
