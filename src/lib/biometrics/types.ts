/**
 * Biometric overlay — shared types (WS5).
 */
export type FatigueLevel = 'fresh' | 'moderate' | 'tired' | 'gassed';
export type BiometricSource = 'manual' | 'webhook' | 'wearable';

export interface BiometricSnapshot {
  id: string;
  gameId: string | null;
  playerId: string;
  heartRateBpm: number | null;
  staminaPct: number | null;
  fatigueLevel: FatigueLevel | null;
  source: BiometricSource;
  recordedAt: string;
}

/** Derived from staminaPct — drives the bar colour and pulse. */
export type StaminaZone = 'green' | 'gold' | 'red';

export function zoneForStamina(pct: number | null | undefined): StaminaZone {
  if (pct == null || pct >= 70) return 'green';
  if (pct >= 40) return 'gold';
  return 'red';
}

export function isHeartRateDanger(bpm: number | null | undefined): boolean {
  return typeof bpm === 'number' && bpm > 180;
}
