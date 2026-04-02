-- Migration: add suspension columns to players table
-- Required by handleManualOpsAction 'player' / 'suspend' action in worker/index.ts

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

COMMENT ON COLUMN players.is_suspended IS 'True when a player has been manually suspended by a super_admin via the Ops console.';
COMMENT ON COLUMN players.suspension_reason IS 'Optional free-text reason recorded at time of suspension.';
