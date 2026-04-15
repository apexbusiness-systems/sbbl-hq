-- Migration: add stream_url to games
-- Adds a WHEP endpoint URL column to the games table so admins can configure
-- per-game live stream URLs from the Supabase dashboard or API.
-- Format: https://stream.sbbl-hq.icu/whep/<stream-key>

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS stream_url TEXT;

COMMENT ON COLUMN public.games.stream_url IS
  'WHEP endpoint URL for this game''s live stream. '
  'Format: https://stream.sbbl-hq.icu/whep/<stream-key> — '
  'Set in Supabase dashboard before going live. '
  'Null means use VITE_WHEP_FALLBACK_URL env var.';
