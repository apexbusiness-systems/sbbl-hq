-- =============================================================================
-- Migration: scores categories — 1-on-1 and special events support
-- =============================================================================

-- Allow non-league game types: make team/league/season refs optional
ALTER TABLE public.games ALTER COLUMN league_id  DROP NOT NULL;
ALTER TABLE public.games ALTER COLUMN season_id  DROP NOT NULL;
ALTER TABLE public.games ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE public.games ALTER COLUMN away_team_id DROP NOT NULL;

-- Category column: 'league' (default), '1v1', 'special_event'
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'league'
    CONSTRAINT games_category_check CHECK (category IN ('league', '1v1', 'special_event'));

-- Event/match title for non-league contexts
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS event_name text;

-- Free-text participant labels for 1v1 and special events
-- (superseded by home_team/away_team FK when those are set)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS participant1_label text;
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS participant2_label text;

-- Explicit game date (independent of schedule_slot)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS game_date date;

-- Optional notes / description
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS notes text;

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_games_category  ON public.games (category);
CREATE INDEX IF NOT EXISTS idx_games_status    ON public.games (status);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON public.games (game_date DESC NULLS LAST);

-- ── Backfill existing league games ─────────────────────────────────────────
UPDATE public.games
  SET  category  = 'league',
       game_date = created_at::date
  WHERE game_date IS NULL;
