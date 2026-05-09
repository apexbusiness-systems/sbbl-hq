/**
 * Biometric realtime reducer — pure-function tests.
 * Guards latest-wins semantics and no-mutation invariant.
 */
import { describe, expect, it } from 'vitest';
import { __applyBiometricSnapshotForTests as apply } from '@/hooks/useBiometricRealtime';
import type { BiometricSnapshot } from '@/lib/biometrics/types';

function snap(
  playerId: string,
  recordedAt: string,
  overrides: Partial<BiometricSnapshot> = {},
): BiometricSnapshot {
  return {
    id: `${playerId}-${recordedAt}`,
    gameId: 'g-1',
    playerId,
    heartRateBpm: 140,
    staminaPct: 80,
    fatigueLevel: 'moderate',
    source: 'manual',
    recordedAt,
    ...overrides,
  };
}

describe('biometric reducer — applySnapshot', () => {
  it('inserts a new player', () => {
    const next = apply([], snap('p1', '2026-04-19T10:00:00Z'));
    expect(next).toHaveLength(1);
    expect(next[0].playerId).toBe('p1');
  });

  it('replaces when incoming is newer', () => {
    const initial = [snap('p1', '2026-04-19T10:00:00Z', { staminaPct: 90 })];
    const next = apply(initial, snap('p1', '2026-04-19T10:00:30Z', { staminaPct: 60 }));
    expect(next).toHaveLength(1);
    expect(next[0].staminaPct).toBe(60);
  });

  it('drops stale snapshots (older than existing)', () => {
    const initial = [snap('p1', '2026-04-19T10:00:30Z', { staminaPct: 60 })];
    const next = apply(initial, snap('p1', '2026-04-19T10:00:00Z', { staminaPct: 90 }));
    expect(next).toBe(initial); // reference-equal: no change
    expect(next[0].staminaPct).toBe(60);
  });

  it('does not mutate input list', () => {
    const initial = [snap('p1', '2026-04-19T10:00:00Z')];
    const snapshot = JSON.stringify(initial);
    apply(initial, snap('p2', '2026-04-19T10:00:30Z'));
    expect(JSON.stringify(initial)).toBe(snapshot);
  });
});
