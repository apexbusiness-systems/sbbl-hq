-- Adds athlete roster fields to the existing, already-correct per-team join
-- table (unique(team_id, user_id), role enum already includes 'player').
-- Backfills from the legacy singleton `players` row so no data is lost.

ALTER TABLE public.team_memberships
  ADD COLUMN IF NOT EXISTS season_id     uuid REFERENCES public.seasons(id),
  ADD COLUMN IF NOT EXISTS jersey_number int,
  ADD COLUMN IF NOT EXISTS position      text,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

UPDATE public.team_memberships tm
SET season_id = t.season_id
FROM public.teams t
WHERE tm.team_id = t.id AND tm.season_id IS NULL;

UPDATE public.team_memberships tm
SET jersey_number = p.jersey_number, position = p.position
FROM public.players p
WHERE tm.user_id = p.user_id AND tm.team_id = p.team_id AND tm.jersey_number IS NULL;

-- [VERIFY BEFORE APPLY] Confirm the auto-generated constraint name before
-- dropping -- run:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.team_memberships'::regclass AND contype = 'u';
-- Default Postgres naming for `unique(team_id, user_id)` declared inline is
-- team_memberships_team_id_user_id_key; adjust the DROP below if different.
ALTER TABLE public.team_memberships
  DROP CONSTRAINT IF EXISTS team_memberships_team_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_memberships_team_user_season
  ON public.team_memberships (team_id, user_id, season_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user
  ON public.team_memberships (user_id);
