-- =============================================================================
-- Migration: stream_reactions — real-time audience reactions for live streams
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stream_reactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID REFERENCES public.games(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reaction_type  TEXT NOT NULL CHECK (reaction_type IN ('fire', 'heart', 'clap')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast aggregation per game + type
CREATE INDEX IF NOT EXISTS idx_stream_reactions_game_type
  ON stream_reactions (game_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_stream_reactions_created
  ON stream_reactions (created_at DESC);

-- RLS: anyone can read counts; authenticated users can insert their own
ALTER TABLE stream_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stream_reactions_select_all" ON stream_reactions
  FOR SELECT USING (true);

CREATE POLICY "stream_reactions_auth_insert" ON stream_reactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Enable Supabase Realtime so the frontend receives live broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE stream_reactions;
