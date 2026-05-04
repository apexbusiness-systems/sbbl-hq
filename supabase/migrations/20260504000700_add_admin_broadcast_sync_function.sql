-- Migration: add_admin_broadcast_sync_function
-- Fixes: A4, A5 — when the admin goes live, stream_sessions and stream_sources
-- were NOT written. They remained empty, causing viewer queries to return nothing.
-- This function is called from the admin panel after the existing
-- stream_admin_config update. It does not replace that write.

-- Step 1: Unique constraints required for ON CONFLICT upserts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stream_sessions_game_id_key'
  ) THEN
    ALTER TABLE public.stream_sessions
      ADD CONSTRAINT stream_sessions_game_id_key UNIQUE (game_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stream_sources_game_id_key'
  ) THEN
    ALTER TABLE public.stream_sources
      ADD CONSTRAINT stream_sources_game_id_key UNIQUE (game_id);
  END IF;
END $$;

-- Step 2: Admin sync function
CREATE OR REPLACE FUNCTION public.admin_sync_broadcast_to_sessions(
  p_game_id       uuid    DEFAULT NULL,
  p_stream_url    text    DEFAULT NULL,
  p_is_going_live boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_going_live THEN
    IF p_game_id IS NOT NULL THEN
      INSERT INTO public.stream_sessions (game_id, status, started_at)
      VALUES (p_game_id, 'live', now())
      ON CONFLICT (game_id)
      DO UPDATE SET status = 'live', started_at = now(), updated_at = now();

      IF p_stream_url IS NOT NULL THEN
        INSERT INTO public.stream_sources
          (game_id, source_label, source_url, is_public_source)
        VALUES (p_game_id, 'main', p_stream_url, true)
        ON CONFLICT (game_id)
        DO UPDATE SET source_url       = EXCLUDED.source_url,
                      is_public_source = true,
                      updated_at       = now();
      END IF;
    END IF;

  ELSE
    IF p_game_id IS NOT NULL THEN
      UPDATE public.stream_sessions
      SET status     = 'ended',
          ended_at   = now(),
          updated_at = now()
      WHERE game_id = p_game_id
        AND status  = 'live';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.admin_sync_broadcast_to_sessions(uuid, text, boolean)
  TO authenticated;
