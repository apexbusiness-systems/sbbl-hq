-- Migration: create league_events table
-- Fully idempotent — safe to run against a fresh DB or one where a prior
-- partial run left the table in an incomplete state.

-- Drop all dependent objects first so CREATE TABLE IF NOT EXISTS always wins
DROP TRIGGER  IF EXISTS league_events_updated_at          ON league_events;
DROP FUNCTION IF EXISTS update_league_events_updated_at();
DROP POLICY   IF EXISTS "league_events_select_published"  ON league_events;
DROP POLICY   IF EXISTS "league_events_admin_all"         ON league_events;
DROP INDEX    IF EXISTS league_events_league_id_idx;
DROP INDEX    IF EXISTS league_events_status_idx;
DROP INDEX    IF EXISTS league_events_event_date_idx;
DROP TABLE    IF EXISTS league_events;

CREATE TABLE league_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid        REFERENCES leagues(id) ON DELETE SET NULL,
  title         text        NOT NULL,
  location      text,
  event_date    date,
  status        text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'archived')),
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_events_league_id_idx  ON league_events (league_id);
CREATE INDEX league_events_status_idx     ON league_events (status);
CREATE INDEX league_events_event_date_idx ON league_events (event_date);

ALTER TABLE league_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_events_select_published"
  ON league_events FOR SELECT
  USING (status = 'published');

CREATE POLICY "league_events_admin_all"
  ON league_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'league_admin')
    )
  );

CREATE OR REPLACE FUNCTION update_league_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER league_events_updated_at
  BEFORE UPDATE ON league_events
  FOR EACH ROW EXECUTE FUNCTION update_league_events_updated_at();
