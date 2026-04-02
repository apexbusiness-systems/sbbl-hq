-- Migration: create league_events table
-- Required by handleManualOpsAction 'event' / 'create' and 'delete' actions in worker/index.ts
-- The old worker incorrectly referenced a table named "events" which does not exist.
-- The correct table is league_events (created here).

CREATE TABLE IF NOT EXISTS league_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid REFERENCES leagues(id) ON DELETE SET NULL,
  title         text NOT NULL,
  location      text,
  event_date    date,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS league_events_league_id_idx ON league_events (league_id);
CREATE INDEX IF NOT EXISTS league_events_status_idx    ON league_events (status);
CREATE INDEX IF NOT EXISTS league_events_event_date_idx ON league_events (event_date);

-- RLS: super_admin can write; authenticated users can read published events
ALTER TABLE league_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_events_select_published"
  ON league_events FOR SELECT
  USING (status = 'published');

CREATE POLICY "league_events_admin_all"
  ON league_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'league_admin')
    )
  );

-- Auto-update updated_at on row changes
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
