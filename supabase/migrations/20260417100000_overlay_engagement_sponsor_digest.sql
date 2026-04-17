-- =============================================================================
-- Migration: Overlay / Engagement / Sponsor / AI Digest subsystems
-- Date:      2026-04-17
-- Owner:     Broadcast Platform
--
-- Introduces every table + RPC required for:
--   1. Scoreboard overlay (OBS chromeless browser source)
--   2. Interactive engagement (polls, predictions, trivia, gamification)
--   3. Sponsor overlay (in-stream sponsor branding + rotation)
--   4. AI weekly digest (cached narrative summaries)
--   5. OBS broadcast control (scene / source / filter commands)
--
-- All tables are RLS-enabled. Read paths that are public are served via
-- the Cloudflare Worker using the service-role key (no RLS), mirroring
-- the `/api/public/*` pattern already in production.
-- =============================================================================

-- ── 1. Scoreboard overlay state ──────────────────────────────────────────────
-- One row per game; updated in real time by the stat-keeper / ops admin.
-- The OBS browser source reads this row via /api/public/overlay/:gameId.
CREATE TABLE IF NOT EXISTS public.overlay_game_state (
  game_id              uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  period               integer NOT NULL DEFAULT 1 CHECK (period >= 1 AND period <= 10),
  period_label         text    NOT NULL DEFAULT 'Q1',
  clock_seconds        integer NOT NULL DEFAULT 600 CHECK (clock_seconds >= 0),
  clock_running        boolean NOT NULL DEFAULT false,
  clock_last_started_at timestamptz,
  home_score           integer NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score           integer NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  home_fouls           integer NOT NULL DEFAULT 0 CHECK (home_fouls >= 0),
  away_fouls           integer NOT NULL DEFAULT 0 CHECK (away_fouls >= 0),
  home_timeouts_left   integer NOT NULL DEFAULT 4 CHECK (home_timeouts_left >= 0),
  away_timeouts_left   integer NOT NULL DEFAULT 4 CHECK (away_timeouts_left >= 0),
  possession           text    NOT NULL DEFAULT 'none'
    CONSTRAINT overlay_game_state_possession_chk CHECK (possession IN ('home','away','none')),
  bonus_home           boolean NOT NULL DEFAULT false,
  bonus_away           boolean NOT NULL DEFAULT false,
  shot_clock_seconds   integer,
  last_event_text      text,
  last_event_at        timestamptz,
  overlay_theme        text    NOT NULL DEFAULT 'default',
  show_sponsor_bug     boolean NOT NULL DEFAULT true,
  show_lower_third     boolean NOT NULL DEFAULT false,
  lower_third_text     text,
  lower_third_subtext  text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid
);

CREATE INDEX IF NOT EXISTS idx_overlay_state_updated_at
  ON public.overlay_game_state (updated_at DESC);

ALTER TABLE public.overlay_game_state ENABLE ROW LEVEL SECURITY;

-- Admin roles can manage overlay; anyone can read (public overlay).
DROP POLICY IF EXISTS overlay_state_read_all ON public.overlay_game_state;
CREATE POLICY overlay_state_read_all ON public.overlay_game_state
  FOR SELECT USING (true);

DROP POLICY IF EXISTS overlay_state_admin_write ON public.overlay_game_state;
CREATE POLICY overlay_state_admin_write ON public.overlay_game_state
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','team_manager','media_operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','team_manager','media_operator')
    )
  );

-- ── 2. Sponsor slots (in-stream branding) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsor_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  tagline         text,
  logo_url        text,
  click_url       text,
  background_color text,
  text_color      text,
  weight          integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  active          boolean NOT NULL DEFAULT true,
  league_id       uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_slots_active
  ON public.sponsor_slots (active, league_id);

ALTER TABLE public.sponsor_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_slots_read_active ON public.sponsor_slots;
CREATE POLICY sponsor_slots_read_active ON public.sponsor_slots
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS sponsor_slots_admin_write ON public.sponsor_slots;
CREATE POLICY sponsor_slots_admin_write ON public.sponsor_slots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin')
    )
  );

CREATE TABLE IF NOT EXISTS public.sponsor_impressions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsor_slots(id) ON DELETE CASCADE,
  game_id    uuid REFERENCES public.games(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'impression'
    CONSTRAINT sponsor_impressions_kind_chk CHECK (kind IN ('impression','click')),
  user_id    uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_impressions_sponsor
  ON public.sponsor_impressions (sponsor_id, occurred_at DESC);

ALTER TABLE public.sponsor_impressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sponsor_impressions_admin_read ON public.sponsor_impressions;
CREATE POLICY sponsor_impressions_admin_read ON public.sponsor_impressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin')
    )
  );

-- ── 3. Interactive engagement (polls, predictions, trivia) ───────────────────
CREATE TABLE IF NOT EXISTS public.engagement_polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid REFERENCES public.games(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'poll'
    CONSTRAINT engagement_polls_kind_chk CHECK (kind IN ('poll','prediction','trivia')),
  question    text NOT NULL,
  options     jsonb NOT NULL,
  correct_option_id text,
  status      text NOT NULL DEFAULT 'open'
    CONSTRAINT engagement_polls_status_chk CHECK (status IN ('draft','open','locked','closed')),
  points_award integer NOT NULL DEFAULT 10 CHECK (points_award >= 0),
  closes_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid
);

CREATE INDEX IF NOT EXISTS idx_engagement_polls_game
  ON public.engagement_polls (game_id, status, created_at DESC);

ALTER TABLE public.engagement_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_polls_read_open ON public.engagement_polls;
CREATE POLICY engagement_polls_read_open ON public.engagement_polls
  FOR SELECT USING (status IN ('open','locked','closed'));

DROP POLICY IF EXISTS engagement_polls_admin_write ON public.engagement_polls;
CREATE POLICY engagement_polls_admin_write ON public.engagement_polls
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','team_manager','media_operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','team_manager','media_operator')
    )
  );

CREATE TABLE IF NOT EXISTS public.engagement_poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES public.engagement_polls(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  option_id   text NOT NULL,
  correct     boolean,
  points_earned integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_votes_poll
  ON public.engagement_poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_engagement_votes_user
  ON public.engagement_poll_votes (user_id, created_at DESC);

ALTER TABLE public.engagement_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_votes_self_read ON public.engagement_poll_votes;
CREATE POLICY engagement_votes_self_read ON public.engagement_poll_votes
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = auth.uid()
      AND ura.role IN ('super_admin','league_admin')
  ));
DROP POLICY IF EXISTS engagement_votes_self_insert ON public.engagement_poll_votes;
CREATE POLICY engagement_votes_self_insert ON public.engagement_poll_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 4. Gamification points ledger ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gamification_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  reason      text NOT NULL,
  game_id     uuid REFERENCES public.games(id) ON DELETE SET NULL,
  poll_id     uuid REFERENCES public.engagement_polls(id) ON DELETE SET NULL,
  points      integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_points_user
  ON public.gamification_points (user_id, created_at DESC);

ALTER TABLE public.gamification_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gamification_points_self_read ON public.gamification_points;
CREATE POLICY gamification_points_self_read ON public.gamification_points
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = auth.uid()
      AND ura.role IN ('super_admin','league_admin')
  ));

-- ── 5. Watch party rooms ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watch_parties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  name        text NOT NULL,
  join_code   text UNIQUE NOT NULL,
  max_members integer NOT NULL DEFAULT 25 CHECK (max_members > 0 AND max_members <= 500),
  status      text NOT NULL DEFAULT 'open'
    CONSTRAINT watch_parties_status_chk CHECK (status IN ('open','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_parties_game
  ON public.watch_parties (game_id, status);

ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_parties_read_open ON public.watch_parties;
CREATE POLICY watch_parties_read_open ON public.watch_parties
  FOR SELECT USING (status = 'open' OR host_user_id = auth.uid());
DROP POLICY IF EXISTS watch_parties_host_write ON public.watch_parties;
CREATE POLICY watch_parties_host_write ON public.watch_parties
  FOR ALL USING (host_user_id = auth.uid()) WITH CHECK (host_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.watch_party_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watch_party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_party_members_user
  ON public.watch_party_members (user_id);

ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_party_members_self ON public.watch_party_members;
CREATE POLICY watch_party_members_self ON public.watch_party_members
  FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_id AND wp.host_user_id = auth.uid()
    )
  )
  WITH CHECK (user_id = auth.uid());

-- ── 6. AI weekly digest cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_weekly_digest (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  week_start   date NOT NULL,
  week_end     date NOT NULL,
  headline     text NOT NULL,
  summary      text NOT NULL,
  sections     jsonb NOT NULL DEFAULT '[]'::jsonb,
  model        text NOT NULL DEFAULT 'fallback',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_weekly_digest_week
  ON public.ai_weekly_digest (week_start DESC);

ALTER TABLE public.ai_weekly_digest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_weekly_digest_read_all ON public.ai_weekly_digest;
CREATE POLICY ai_weekly_digest_read_all ON public.ai_weekly_digest
  FOR SELECT USING (true);

-- ── 7. OBS control commands queue ────────────────────────────────────────────
-- Commands placed in this queue are consumed by an obs-agent process
-- running on the broadcast machine which forwards them over OBS WebSocket.
-- The worker writes commands; the agent polls and acknowledges via
-- `ack_obs_command`. Schema is intentionally minimal.
CREATE TABLE IF NOT EXISTS public.obs_commands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid REFERENCES public.games(id) ON DELETE SET NULL,
  kind        text NOT NULL
    CONSTRAINT obs_commands_kind_chk CHECK (kind IN (
      'scene_switch',
      'source_visibility',
      'filter_enable',
      'start_stream',
      'stop_stream',
      'start_record',
      'stop_record',
      'set_text_source',
      'refresh_browser_source'
    )),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'pending'
    CONSTRAINT obs_commands_status_chk CHECK (status IN ('pending','acked','failed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  acked_at    timestamptz,
  created_by  uuid,
  error_text  text
);

CREATE INDEX IF NOT EXISTS idx_obs_commands_status
  ON public.obs_commands (status, created_at);

ALTER TABLE public.obs_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS obs_commands_admin_all ON public.obs_commands;
CREATE POLICY obs_commands_admin_all ON public.obs_commands
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','media_operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role IN ('super_admin','league_admin','media_operator')
    )
  );

-- ── 8. Gamification leaderboard RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gamification_leaderboard(p_limit int DEFAULT 25)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_points bigint,
  correct_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gp.user_id,
    COALESCE(pr.display_name, 'Anonymous') AS display_name,
    SUM(gp.points)::bigint AS total_points,
    SUM(CASE WHEN gp.points > 0 THEN 1 ELSE 0 END)::bigint AS correct_count
  FROM public.gamification_points gp
  LEFT JOIN public.profiles pr ON pr.user_id = gp.user_id
  GROUP BY gp.user_id, pr.display_name
  ORDER BY total_points DESC
  LIMIT COALESCE(p_limit, 25);
$$;

GRANT EXECUTE ON FUNCTION public.get_gamification_leaderboard(int) TO anon, authenticated, service_role;

-- ── 9. Auto-upsert overlay state row on new game ─────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_overlay_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.overlay_game_state (game_id)
  VALUES (NEW.id)
  ON CONFLICT (game_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_overlay_state ON public.games;
CREATE TRIGGER trg_ensure_overlay_state
AFTER INSERT ON public.games
FOR EACH ROW EXECUTE FUNCTION public.ensure_overlay_state();

-- Backfill: create a row for every existing game.
INSERT INTO public.overlay_game_state (game_id)
SELECT g.id FROM public.games g
ON CONFLICT (game_id) DO NOTHING;
