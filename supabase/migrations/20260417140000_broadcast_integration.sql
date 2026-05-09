-- =============================================================================
-- Migration: Broadcast integration — realtime, lower-third, highlights, reactions
-- Date:      2026-04-17
-- Owner:     Broadcast Platform
--
-- Closes four residual broadcast gaps in one idempotent migration:
--   1. Publish games / overlay_game_state / stream_chat_messages to
--      supabase_realtime so the frontend receives row changes live.
--   2. Auto-fire a lower-third overlay banner whenever a player crosses
--      25 PTS in a single game (INSERT into player_game_stats).
--   3. Introduce the highlight_clips table (admin-managed, public read)
--      for post-game and auto-generated highlight reels.
--   4. Auto-insert a highlight_clips row whenever the overlay scoreboard
--      registers a score change (home_score or away_score increases).
--   5. Expose `get_reaction_aggregate(game_id, window_seconds)` — a
--      grouped-count RPC used by the overlay reaction-burst visualiser.
--
-- All tables are RLS-enabled. All trigger bodies are wrapped in
-- EXCEPTION WHEN OTHERS so overlay / stat-keeper writes are never
-- blocked by downstream broadcast automation.
-- =============================================================================

-- ── 1. Realtime publication ──────────────────────────────────────────────────
-- Idempotent add; pg_publication_tables is introspected before ALTER so
-- re-running this migration on an already-configured environment is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'overlay_game_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.overlay_game_state;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stream_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_chat_messages;
  END IF;
END $$;

-- ── 2. Lower-third auto-fire trigger ─────────────────────────────────────────
-- When a stat-keeper inserts a player_game_stats row with pts >= 25 for a
-- game currently in a live state, surface the achievement as an overlay
-- lower-third banner ("Player Name — 27 PTS · 5 REB · 3 AST"). Any error
-- (missing overlay row, permission quirk, etc.) is swallowed — the
-- stat-keeper write must always succeed.
CREATE OR REPLACE FUNCTION public.auto_fire_lower_third()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name   text;
  v_status text;
BEGIN
  IF NEW.pts IS NULL OR NEW.pts < 25 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT g.status INTO v_status
    FROM public.games g
    WHERE g.id = NEW.game_id;

    -- Tolerate both historical spellings of the in-play status.
    IF v_status IS DISTINCT FROM 'live' AND v_status IS DISTINCT FROM 'in_progress' THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(pr.full_name, pr.display_name, 'Player')
      INTO v_name
    FROM public.players p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.id = NEW.player_id;

    UPDATE public.overlay_game_state
       SET lower_third_text    = COALESCE(v_name, 'Player'),
           lower_third_subtext = NEW.pts::text
             || ' PTS · ' || COALESCE(NEW.reb, 0)::text
             || ' REB · ' || COALESCE(NEW.ast, 0)::text || ' AST',
           show_lower_third    = true,
           updated_at          = now()
     WHERE game_id = NEW.game_id;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the stat-keeper on an overlay-automation failure.
    RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fire_lower_third ON public.player_game_stats;
CREATE TRIGGER trg_auto_fire_lower_third
AFTER INSERT ON public.player_game_stats
FOR EACH ROW EXECUTE FUNCTION public.auto_fire_lower_third();

-- ── 3. Highlight clips table ─────────────────────────────────────────────────
-- Admin-managed (and trigger-authored) record of highlight-worthy moments.
-- media_url is nullable — rows can be seeded by automation and have the
-- video / thumbnail filled in later by a media operator.
CREATE TABLE IF NOT EXISTS public.highlight_clips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'manual'
    CONSTRAINT highlight_clips_kind_chk CHECK (kind IN ('manual','auto_score','auto_cheer')),
  period         integer,
  clock_seconds  integer,
  home_score     integer,
  away_score     integer,
  player_id      uuid REFERENCES public.players(id) ON DELETE SET NULL,
  title          text,
  description    text,
  media_url      text,
  thumbnail_url  text,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlight_clips_game_occurred
  ON public.highlight_clips (game_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_highlight_clips_kind_occurred
  ON public.highlight_clips (kind, occurred_at DESC);

ALTER TABLE public.highlight_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS highlight_clips_read_all ON public.highlight_clips;
CREATE POLICY highlight_clips_read_all ON public.highlight_clips
  FOR SELECT USING (true);

DROP POLICY IF EXISTS highlight_clips_admin_write ON public.highlight_clips;
CREATE POLICY highlight_clips_admin_write ON public.highlight_clips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','media_operator','team_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','media_operator','team_manager')
    )
  );

-- ── 4. Auto-highlight on score change trigger ────────────────────────────────
-- Whenever the live scoreboard registers a scoring play (home_score or
-- away_score strictly increases), seed a highlight_clips row. The media
-- operator (or a post-game job) fills in media_url / thumbnail_url later.
CREATE OR REPLACE FUNCTION public.auto_highlight_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.highlight_clips (
      game_id,
      kind,
      period,
      clock_seconds,
      home_score,
      away_score,
      title
    ) VALUES (
      NEW.game_id,
      'auto_score',
      NEW.period,
      NEW.clock_seconds,
      NEW.home_score,
      NEW.away_score,
      'Score: ' || NEW.home_score::text || '-' || NEW.away_score::text
    );
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- Overlay writes must never fail because of highlight-seeding errors.
    RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_highlight_on_score ON public.overlay_game_state;
CREATE TRIGGER trg_auto_highlight_on_score
AFTER UPDATE ON public.overlay_game_state
FOR EACH ROW
WHEN (NEW.home_score > OLD.home_score OR NEW.away_score > OLD.away_score)
EXECUTE FUNCTION public.auto_highlight_on_score();

-- ── 5. Reaction aggregate RPC ────────────────────────────────────────────────
-- Returns per-reaction-type counts for a given game over the last N seconds.
-- Used by the overlay's reaction-burst visualiser and by the engagement
-- dashboard to surface fan sentiment during a live broadcast.
CREATE OR REPLACE FUNCTION public.get_reaction_aggregate(
  p_game_id uuid,
  p_window_seconds int DEFAULT 30
)
RETURNS TABLE (
  reaction_type text,
  count         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.reaction_type,
    COUNT(*)::bigint AS count
  FROM public.stream_reactions sr
  WHERE sr.game_id = p_game_id
    AND sr.created_at >= now() - (COALESCE(p_window_seconds, 30) || ' seconds')::interval
  GROUP BY sr.reaction_type
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_reaction_aggregate(uuid, int)
  TO anon, authenticated, service_role;
