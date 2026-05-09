-- Migration: fix_stream_rls_and_read_policies
-- Fixes: A1, A2 — stream_sessions and stream_sources had zero SELECT policies
-- for authenticated/anon roles, causing all client queries to return empty.
-- Adds four read-only SELECT policies. Does not remove or alter any existing policy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stream_sessions'
      AND policyname = 'authenticated_read_live_stream_sessions'
  ) THEN
    CREATE POLICY "authenticated_read_live_stream_sessions"
    ON public.stream_sessions FOR SELECT TO authenticated
    USING (status = 'live');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stream_sessions'
      AND policyname = 'anon_read_live_stream_sessions'
  ) THEN
    CREATE POLICY "anon_read_live_stream_sessions"
    ON public.stream_sessions FOR SELECT TO anon
    USING (status = 'live');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stream_sources'
      AND policyname = 'authenticated_read_public_stream_sources'
  ) THEN
    CREATE POLICY "authenticated_read_public_stream_sources"
    ON public.stream_sources FOR SELECT TO authenticated
    USING (is_public_source = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stream_sources'
      AND policyname = 'anon_read_public_stream_sources'
  ) THEN
    CREATE POLICY "anon_read_public_stream_sources"
    ON public.stream_sources FOR SELECT TO anon
    USING (is_public_source = true);
  END IF;
END $$;
