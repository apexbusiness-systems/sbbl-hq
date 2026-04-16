-- game_events (core truth ledger)
CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_ts TIMESTAMPTZ NOT NULL,
  video_alignment_ms INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL CHECK (event_type IN ('score','foul','shot','steal','block','rebound','moment_marker','command','clip_request')),
  payload JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('operator','scoreboard','cv','sim_command')),
  confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON game_events FOR SELECT USING (true);
CREATE POLICY "admin_all" ON game_events FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = auth.uid() AND (role = 'league_admin' OR role = 'super_admin')
  )
);
CREATE POLICY "owner_edit" ON game_events FOR UPDATE USING (auth.uid() = (SELECT captain_id FROM teams WHERE id = (SELECT team_id FROM games WHERE id = game_events.game_id)));

-- player_consent_receipts (PIPA/PIPEDA lock)
CREATE TABLE IF NOT EXISTS player_consent_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  purpose TEXT NOT NULL,
  consent_given_at TIMESTAMPTZ NOT NULL,
  revocable BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  retention_days INTEGER DEFAULT 365
);
ALTER TABLE player_consent_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON player_consent_receipts FOR SELECT USING (true);
CREATE POLICY "admin_all" ON player_consent_receipts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = auth.uid() AND (role = 'league_admin' OR role = 'super_admin')
  )
);
CREATE POLICY "owner_edit" ON player_consent_receipts FOR UPDATE USING (auth.uid() = (SELECT user_id FROM players WHERE id = player_consent_receipts.player_id));

CREATE INDEX idx_game_events_game_ts ON game_events(game_id, event_ts);
