-- Migration: livestream_broadcast_events
-- Adds first-class broadcast event entities, lifecycle status, RLS policies,
-- and updated_at trigger (reuses public.touch_updated_at() from core_schema).
-- Fully idempotent — safe on fresh DB or after a partial prior run.

DROP TRIGGER  IF EXISTS livestream_broadcast_events_updated_at ON public.livestream_broadcast_events;
DROP INDEX    IF EXISTS lbe_slug_idx;
DROP INDEX    IF EXISTS lbe_status_idx;
DROP INDEX    IF EXISTS lbe_scheduled_start_idx;
DROP INDEX    IF EXISTS lbe_league_id_idx;
DROP INDEX    IF EXISTS lbe_game_id_idx;
DROP POLICY   IF EXISTS "lbe_public_read"   ON public.livestream_broadcast_events;
DROP POLICY   IF EXISTS "lbe_admin_all"     ON public.livestream_broadcast_events;
DROP TABLE    IF EXISTS public.livestream_broadcast_events;

CREATE TABLE public.livestream_broadcast_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable so a broadcast can exist without being tied to a specific league.
  league_id            uuid        REFERENCES public.leagues(id)  ON DELETE SET NULL,
  season_id            uuid        REFERENCES public.seasons(id)  ON DELETE SET NULL,
  -- game_id is NULLABLE per Stream Independence Contract (CLAUDE.md §4).
  game_id              uuid        REFERENCES public.games(id)    ON DELETE SET NULL,
  title                text        NOT NULL CHECK (length(trim(title)) > 0),
  slug                 text        NOT NULL UNIQUE
                                   CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{0,127}$'),
  description          text,
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN (
                                     'draft', 'scheduled', 'live',
                                     'ended', 'cancelled', 'archived'
                                   )),
  scheduled_start_at   timestamptz,
  actual_start_at      timestamptz,
  actual_end_at        timestamptz,
  -- HTTPS URLs only (enforced in the worker layer before writes reach the DB).
  stream_url           text,
  embed_url            text,
  thumbnail_url        text,
  visibility           text        NOT NULL DEFAULT 'public'
                                   CHECK (visibility IN ('public', 'private', 'unlisted')),
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- slug has an implicit unique index from the UNIQUE constraint; make it explicit
-- so it shows up in pg_indexes with a predictable name.
CREATE UNIQUE INDEX lbe_slug_idx         ON public.livestream_broadcast_events (slug);
CREATE INDEX        lbe_status_idx       ON public.livestream_broadcast_events (status);
CREATE INDEX        lbe_scheduled_start_idx
                                         ON public.livestream_broadcast_events (scheduled_start_at);
CREATE INDEX        lbe_league_id_idx    ON public.livestream_broadcast_events (league_id);
CREATE INDEX        lbe_game_id_idx      ON public.livestream_broadcast_events (game_id);

ALTER TABLE public.livestream_broadcast_events ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Public: read scheduled/live/ended/cancelled + visible=public.
-- Draft and archived are ops-only.
CREATE POLICY "lbe_public_read"
  ON public.livestream_broadcast_events
  FOR SELECT
  USING (
    status IN ('scheduled', 'live', 'ended', 'cancelled')
    AND visibility = 'public'
  );

-- Admins (super_admin + league_admin) have full CRUD.
CREATE POLICY "lbe_admin_all"
  ON public.livestream_broadcast_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments
      WHERE user_id  = auth.uid()
        AND role IN ('super_admin', 'league_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments
      WHERE user_id  = auth.uid()
        AND role IN ('super_admin', 'league_admin')
    )
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────
-- Reuses touch_updated_at() defined in 202603270001_core_schema.sql.
CREATE TRIGGER livestream_broadcast_events_updated_at
  BEFORE UPDATE ON public.livestream_broadcast_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
