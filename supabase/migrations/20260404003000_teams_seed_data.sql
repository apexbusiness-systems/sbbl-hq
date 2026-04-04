-- =============================================================================
-- Migration: teams seed data + games score columns
-- =============================================================================

-- Add score columns to games (required by /api/teams standings query)
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS home_score integer;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS away_score integer;

-- Add pre-computed record column to teams
-- Used as standings fallback when no game records exist yet
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS record jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seasons
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.seasons (league_id, name, status)
SELECT id, 'Season 1', 'published'
FROM public.leagues WHERE code = 'SBBL'
ON CONFLICT (league_id, name) DO NOTHING;

INSERT INTO public.seasons (league_id, name, status)
SELECT id, 'Season 3', 'published'
FROM public.leagues WHERE code = 'WBL'
ON CONFLICT (league_id, name) DO NOTHING;

INSERT INTO public.seasons (league_id, name, status)
SELECT id, 'Season 1', 'published'
FROM public.leagues WHERE code = 'TGIFBL'
ON CONFLICT (league_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Divisions
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.divisions (league_id, season_id, name)
SELECT l.id, s.id, 'Panalay A'
FROM public.leagues l JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 1'
WHERE l.code = 'SBBL'
ON CONFLICT (season_id, name) DO NOTHING;

INSERT INTO public.divisions (league_id, season_id, name)
SELECT l.id, s.id, 'Panalay B'
FROM public.leagues l JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 1'
WHERE l.code = 'SBBL'
ON CONFLICT (season_id, name) DO NOTHING;

INSERT INTO public.divisions (league_id, season_id, name)
SELECT l.id, s.id, 'Main'
FROM public.leagues l JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 3'
WHERE l.code = 'WBL'
ON CONFLICT (season_id, name) DO NOTHING;

INSERT INTO public.divisions (league_id, season_id, name)
SELECT l.id, s.id, 'Group 1'
FROM public.leagues l JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 1'
WHERE l.code = 'TGIFBL'
ON CONFLICT (season_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Teams — SBBL Season 1
-- ─────────────────────────────────────────────────────────────────────────────
WITH ctx AS (
  SELECT l.id AS league_id, s.id AS season_id,
    d_a.id AS div_a, d_b.id AS div_b
  FROM public.leagues l
  JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 1'
  JOIN public.divisions d_a ON d_a.season_id = s.id AND d_a.name = 'Panalay A'
  JOIN public.divisions d_b ON d_b.season_id = s.id AND d_b.name = 'Panalay B'
  WHERE l.code = 'SBBL'
)
INSERT INTO public.teams (league_id, season_id, division_id, name, status, record)
SELECT ctx.league_id, ctx.season_id, division_id, name, 'published', record
FROM ctx, (VALUES
  (ctx.div_a, 'Panalay Kings',   '{"wins":8,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  (ctx.div_a, 'Solid North',     '{"wins":7,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  (ctx.div_a, 'Gensan Warriors', '{"wins":6,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  (ctx.div_b, 'Rim Rattlers',    '{"wins":5,"losses":5,"ptsFor":0,"ptsAgainst":0}'::jsonb)
) AS t(division_id, name, record)
ON CONFLICT (season_id, name) DO UPDATE SET record = EXCLUDED.record;

-- ─────────────────────────────────────────────────────────────────────────────
-- Teams — WBL Season 3
-- ─────────────────────────────────────────────────────────────────────────────
WITH ctx AS (
  SELECT l.id AS league_id, s.id AS season_id, d.id AS div_id
  FROM public.leagues l
  JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 3'
  JOIN public.divisions d ON d.season_id = s.id AND d.name = 'Main'
  WHERE l.code = 'WBL'
)
INSERT INTO public.teams (league_id, season_id, division_id, name, status, record)
SELECT ctx.league_id, ctx.season_id, ctx.div_id, t.name, 'published', t.record
FROM ctx, (VALUES
  ('OSY',                '{"wins":5,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Rebelde Jrs',        '{"wins":6,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Solid North',        '{"wins":4,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Crosslinx Warriors', '{"wins":7,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Rebelde',            '{"wins":1,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Downtown',           '{"wins":7,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('La Liga Elite',      '{"wins":3,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Blacksmith',         '{"wins":6,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Splash',             '{"wins":6,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('SPG',                '{"wins":2,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Harina x Wild Dogs', '{"wins":1,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('NSD',                '{"wins":3,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('4Lifers',            '{"wins":7,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Serviteurs',         '{"wins":5,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Batang Kanto',       '{"wins":1,"losses":0,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Disciples',          '{"wins":4,"losses":0,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Ball is Life',       '{"wins":4,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb)
) AS t(name, record)
ON CONFLICT (season_id, name) DO UPDATE SET record = EXCLUDED.record;

-- ─────────────────────────────────────────────────────────────────────────────
-- Teams — TGIFBL Season 1
-- ─────────────────────────────────────────────────────────────────────────────
WITH ctx AS (
  SELECT l.id AS league_id, s.id AS season_id, d.id AS div_id
  FROM public.leagues l
  JOIN public.seasons s ON s.league_id = l.id AND s.name = 'Season 1'
  JOIN public.divisions d ON d.season_id = s.id AND d.name = 'Group 1'
  WHERE l.code = 'TGIFBL'
)
INSERT INTO public.teams (league_id, season_id, division_id, name, status, record)
SELECT ctx.league_id, ctx.season_id, ctx.div_id, t.name, 'published', t.record
FROM ctx, (VALUES
  ('Solid North',         '{"wins":0,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('OSY x LCL',          '{"wins":2,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Batang Riles x Tri J','{"wins":7,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('J Elite',             '{"wins":2,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('YG',                  '{"wins":6,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Conceited Fantasy',   '{"wins":7,"losses":0,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('C&F',                 '{"wins":3,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('City Above Elite',    '{"wins":7,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Over Under',          '{"wins":3,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Full Time Ballers',   '{"wins":5,"losses":2,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('DBRKDZ',              '{"wins":3,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('BLBG',                '{"wins":5,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Mantiku',             '{"wins":7,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Fourteen Ounce',      '{"wins":4,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Ball is Life',        '{"wins":3,"losses":3,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('JC Trans Jrs',        '{"wins":6,"losses":4,"ptsFor":0,"ptsAgainst":0}'::jsonb),
  ('Banayad Hoopers',     '{"wins":1,"losses":1,"ptsFor":0,"ptsAgainst":0}'::jsonb)
) AS t(name, record)
ON CONFLICT (season_id, name) DO UPDATE SET record = EXCLUDED.record;
