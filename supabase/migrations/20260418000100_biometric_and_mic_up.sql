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
-- Biometric snapshots were extracted into
-- 20260419120000_biometric_snapshots.sql to avoid duplicate table ownership
-- across migrations while preserving identical final schema.

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
