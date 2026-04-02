-- Migration: create league_events table
-- Required by handleManualOpsAction 'event' / 'create' and 'delete' actions in worker/index.ts
-- The old worker incorrectly referenced a table named "events" which does not exist.
-- The correct table is league_events (created here).

-- Drop indexes first (idempotent re-run safety)
DROP INDEX IF EXISTS league_events_league_id_idx;
DROP INDEX IF EXISTS league_events_status_idx;
DROP INDEX IF EXISTS league_events_event_date_idx;

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

-- Add status column if the table already existed without it (re-run safety)
ALTER TABLE league_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'league_events' AND constraint_name = 'league_events_status_check'
  ) THEN
    ALTER TABLE league_events
      ADD CONSTRAINT league_events_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS league_events_league_id_idx  ON league_events (league_id);
CREATE INDEX IF NOT EXISTS league_events_status_idx     ON league_events (status);
CREATE INDEX IF NOT EXISTS league_events_event_date_idx ON league_events (event_date);

-- RLS
ALTER TABLE league_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_events_select_published" ON league_events;
CREATE POLICY "league_events_select_published"
  ON league_events FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "league_events_admin_all" ON league_events;
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

DROP TRIGGER IF EXISTS league_events_updated_at ON league_events;
CREATE TRIGGER league_events_updated_at
  BEFORE UPDATE ON league_events
  FOR EACH ROW EXECUTE FUNCTION update_league_events_updated_at();
