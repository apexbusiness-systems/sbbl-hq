-- Partial unique index: only league-category games need a natural dedup
-- key. 1v1/special_event games legitimately have no team FK and no season
-- scoping requirement, so they are excluded (WHERE category = 'league').
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_league_dedup
  ON public.games (season_id, home_team_id, away_team_id, game_date)
  WHERE category = 'league';

-- Defensive: league-category games should have both team FKs. Not a hard
-- CHECK (would break existing 1v1 rows if category is ever mis-set), but
-- flag orphans for the ops team via a lightweight view.
CREATE OR REPLACE VIEW public.vw_orphan_league_games AS
SELECT id, league_id, participant1_label, participant2_label, game_date, created_at
FROM public.games
WHERE category = 'league'
  AND (home_team_id IS NULL OR away_team_id IS NULL);
GRANT SELECT ON public.vw_orphan_league_games TO service_role;
