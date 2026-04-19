/**
 * WS5 — Biometric API client.
 */
import { apiFetch } from '@/lib/api/client';
import type { BiometricSnapshot, FatigueLevel } from '@/lib/biometrics/types';

function toSnapshot(row: Record<string, unknown>): BiometricSnapshot {
  return {
    id: String(row.id ?? ''),
    gameId: (row.game_id as string | null) ?? null,
    playerId: String(row.player_id ?? ''),
    heartRateBpm: (row.heart_rate_bpm as number | null) ?? null,
    staminaPct: (row.stamina_pct as number | null) ?? null,
    fatigueLevel: (row.fatigue_level as FatigueLevel | null) ?? null,
    source: ((row.source as string) ?? 'manual') as BiometricSnapshot['source'],
    recordedAt: String(row.recorded_at ?? ''),
  };
}

export async function fetchLatestBiometrics(gameId: string): Promise<BiometricSnapshot[]> {
  const res = await apiFetch<{ ok: boolean; data: Record<string, unknown>[] }>(
    `/api/streams/${encodeURIComponent(gameId)}/biometrics/latest`,
  );
  return (res.data ?? []).map(toSnapshot);
}

export interface IngestBiometricArgs {
  gameId: string;
  playerId: string;
  heartRateBpm?: number | null;
  staminaPct?: number | null;
  fatigueLevel?: FatigueLevel | null;
  source?: 'manual' | 'webhook' | 'wearable';
  recordedAt?: string;
}

export async function ingestBiometric(args: IngestBiometricArgs): Promise<BiometricSnapshot> {
  const { gameId, ...body } = args;
  const res = await apiFetch<{ ok: boolean; snapshot: Record<string, unknown> }>(
    `/api/streams/${encodeURIComponent(gameId)}/biometrics`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return toSnapshot(res.snapshot);
}
