-- =============================================================================
-- Migration: Biometric Status Bars (WS5) + Mic Up Series overlays (WS6)
-- Date:      2026-04-18
-- Owner:     Broadcast Platform
--
-- Purely additive. game_id is nullable per Stream Independence Contract.
-- All policies use has_any_role() (the canonical auth helper) —
-- get_user_role() is NOT defined in this schema. Every INSERT policy
-- uses WITH CHECK (Postgres rejects USING on INSERT: SQLSTATE 42601).
--
-- overlay_event_log is also created by
-- 20260418120000_playback_provider_abstraction.sql (WS1). Both migrations
-- guard with CREATE TABLE IF NOT EXISTS so whichever runs first wins
-- the DDL; the later run is a no-op. Policies DROP IF EXISTS before
-- recreate so reruns are idempotent.
-- =============================================================================

-- ── Biometric Status Bars (WS5) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_biometric_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable by design (Stream Independence Contract). A biometric row
  -- for an off-broadcast practice session still belongs to a player.
  game_id           UUID,
  player_id         UUID NOT NULL,
  heart_rate_bpm    INT,
  stamina_pct       INT CHECK (stamina_pct IS NULL OR stamina_pct BETWEEN 0 AND 100),
  fatigue_level     TEXT CHECK (fatigue_level IS NULL OR fatigue_level IN ('fresh', 'moderate', 'tired', 'gassed')),
  source            TEXT NOT NULL DEFAULT 'manual',
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometric_game_player
  ON public.player_biometric_snapshots(game_id, player_id, recorded_at DESC)
  WHERE game_id IS NOT NULL;

ALTER TABLE public.player_biometric_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.player_biometric_snapshots;
CREATE POLICY "public_read"
  ON public.player_biometric_snapshots
  FOR SELECT
  USING (TRUE);

-- INSERT policies MUST use WITH CHECK (not USING) — Postgres enforces
-- this at parse time (SQLSTATE 42601 "only WITH CHECK expression
-- allowed for INSERT"). Canonical auth helper is has_any_role(); the
-- spec's placeholder get_user_role() does not exist in this schema.
DROP POLICY IF EXISTS "admin_write" ON public.player_biometric_snapshots;
CREATE POLICY "admin_write"
  ON public.player_biometric_snapshots
  FOR INSERT
  WITH CHECK (
    public.has_any_role(ARRAY['league_admin','super_admin']::public.app_role[])
  );

DROP POLICY IF EXISTS "admin_update" ON public.player_biometric_snapshots;
CREATE POLICY "admin_update"
  ON public.player_biometric_snapshots
  FOR UPDATE
  USING (
    public.has_any_role(ARRAY['league_admin','super_admin']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(ARRAY['league_admin','super_admin']::public.app_role[])
  );

-- ── Mic Up Series Branding (WS6) ─────────────────────────────────────────────
-- NOTE: overlay_event_log is ALSO created by
-- 20260418120000_playback_provider_abstraction.sql. CREATE TABLE
-- IF NOT EXISTS + DROP POLICY IF EXISTS makes either migration order
-- safe.

CREATE TABLE IF NOT EXISTS public.overlay_event_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable for non-game overlays (e.g. pre-show intro stings).
  game_id       UUID,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  triggered_by  UUID NOT NULL,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.overlay_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_overlay" ON public.overlay_event_log;
CREATE POLICY "public_read_overlay"
  ON public.overlay_event_log
  FOR SELECT
  USING (TRUE);

-- The "ALL" form covers INSERT/UPDATE/DELETE in one policy; Postgres
-- accepts USING + WITH CHECK together for ALL (unlike bare INSERT).
DROP POLICY IF EXISTS "admin_all" ON public.overlay_event_log;
CREATE POLICY "admin_all"
  ON public.overlay_event_log
  FOR ALL
  USING (
    public.has_any_role(ARRAY['league_admin','super_admin']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(ARRAY['league_admin','super_admin']::public.app_role[])
  );
