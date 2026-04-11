-- Migration: create_broadcast_sessions
-- Purpose: Track active live broadcast sessions for the /live page

CREATE TABLE IF NOT EXISTS public.broadcast_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  stream_url    TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'facebook' CHECK (platform IN ('facebook', 'youtube', 'custom')),
  status        TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('live', 'offline', 'scheduled')),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcast_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcast_sessions'
      AND policyname = 'public_read_live_sessions'
  ) THEN
    CREATE POLICY "public_read_live_sessions"
      ON public.broadcast_sessions FOR SELECT
      USING (status = 'live');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'broadcast_sessions'
      AND policyname = 'admin_manage_sessions'
  ) THEN
    CREATE POLICY "admin_manage_sessions"
      ON public.broadcast_sessions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_broadcast_sessions_status_started
  ON public.broadcast_sessions (status, started_at DESC);

INSERT INTO public.broadcast_sessions (title, stream_url, platform, status)
SELECT 'Default', 'https://facebook.com/sbblhq', 'facebook', 'offline'
WHERE NOT EXISTS (SELECT 1 FROM public.broadcast_sessions);
