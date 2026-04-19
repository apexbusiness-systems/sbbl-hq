-- Biometric Status Bars (WS5)
CREATE TABLE IF NOT EXISTS player_biometric_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID NOT NULL,
  player_id         UUID NOT NULL,
  heart_rate_bpm    INT,
  stamina_pct       INT CHECK (stamina_pct BETWEEN 0 AND 100),
  fatigue_level     TEXT CHECK (fatigue_level IN ('fresh', 'moderate', 'tired', 'gassed')),
  source            TEXT NOT NULL DEFAULT 'manual',
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometric_game_player
  ON player_biometric_snapshots(game_id, player_id, recorded_at DESC);

ALTER TABLE player_biometric_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON player_biometric_snapshots;
CREATE POLICY "public_read" ON player_biometric_snapshots FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_write" ON player_biometric_snapshots;
CREATE POLICY "admin_write" ON player_biometric_snapshots
  FOR INSERT USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Mic Up Series Branding (WS6)
CREATE TABLE IF NOT EXISTS overlay_event_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  triggered_by UUID NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE overlay_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON overlay_event_log;
CREATE POLICY "admin_all" ON overlay_event_log
  FOR ALL USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "public_read_overlay" ON overlay_event_log;
CREATE POLICY "public_read_overlay" ON overlay_event_log FOR SELECT USING (TRUE);