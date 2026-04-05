-- =============================================================================
-- Migration: seed WBL Season 3 game scores from POTG data
-- =============================================================================

WITH wbl AS (
  SELECT l.id AS lid, s.id AS sid
  FROM public.leagues l
  JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 3'
  WHERE l.code = 'WBL'
)
INSERT INTO public.games (
  league_id, season_id, home_team_id, away_team_id,
  home_score, away_score, status, category, game_date, notes, published
)
SELECT
  w.lid, w.sid, ht.id, at.id,
  g.hs, g.as_, 'final', 'league', g.gd::date, g.n, true
FROM wbl w
CROSS JOIN (VALUES
  ('OSY',            'Rebelde Jrs',        80, 85, '2026-04-04', 'POTG: Rex Aldous Manalo (Rebelde Jrs) — 24 PTS, 6 REBS, 6 ASSTS'),
  ('Blacksmith',     'La Liga Elite',      84, 80, '2026-04-04', 'POTG: Angelo Frez (Blacksmith) — 30 PTS, 6 REBS, 7 ASSTS'),
  ('Batang Kanto',   'Serviteurs',         43, 62, '2026-04-04', 'POTG: Shawn Cox (Serviteurs) — 20 PTS, 7 REBS, 6 ASSTS'),
  ('SPG',            'Splash',             77, 80, '2026-04-04', 'POTG: JT Balangui (Splash) — 20 PTS, 6 REBS, 8 ASSTS'),
  ('La Liga Elite',  'Harina x Wild Dogs', 65, 95, '2026-04-04', 'POTG: Jaycee Masilungan (Harina x Wild Dogs) — 22 PTS, 6 REBS, 5 ASSTS'),
  ('Downtown',       'Rebelde',            62, 67, '2026-04-04', 'POTG: RR Fabiana (Rebelde) — 18 PTS, 3 REBS, 4 ASSTS'),
  ('Solid North',    'Crosslinx Warriors', 56, 63, '2026-04-04', 'POTG: Tee Jay Reymundo (Crosslinx Warriors) — 30 PTS, 4 REBS, 4 ASSTS'),
  ('NSD',            '4Lifers',            65, 71, '2026-04-04', 'POTG: Robert Ocampo (4Lifers) — 22 PTS, 8 REBS, 7 ASSTS')
) AS g(hn, an, hs, as_, gd, n)
LEFT JOIN public.teams ht ON ht.name = g.hn AND ht.league_id = w.lid AND ht.season_id = w.sid
LEFT JOIN public.teams at ON at.name = g.an AND at.league_id = w.lid AND at.season_id = w.sid;
