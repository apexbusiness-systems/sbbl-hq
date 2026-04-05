-- Adds a unique constraint on (user_id, game_id, idempotency_key) to
-- stream_access_sessions. This backs the atomic upsert in
-- createOrRefreshPlaybackSession and eliminates the TOCTOU race where
-- two rapid requests could both miss the SELECT and create duplicates.
--
-- The partial unique index already exists for the hot-path query pattern;
-- this adds a full unique constraint for the upsert ON CONFLICT clause.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_stream_session_user_game_key'
  ) THEN
    ALTER TABLE public.stream_access_sessions
      ADD CONSTRAINT uq_stream_session_user_game_key
      UNIQUE (user_id, game_id, idempotency_key);
  END IF;
END $$;
