/**
 * WS5 — biometric realtime subscription.
 *
 * Subscribes to the `biometrics:{gameId}` broadcast channel AND the
 * `player_biometric_snapshots` Supabase Realtime channel for inserts.
 * Either signal resolves into the same reducer; whichever arrives first
 * updates the overlay.
 *
 * Reducer invariant: latest-per-player wins (by recordedAt). Stale
 * broadcasts (older than the existing cached snapshot) are dropped.
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { BiometricSnapshot, FatigueLevel } from '@/lib/biometrics/types';

function dbRowToSnapshot(row: Record<string, unknown>): BiometricSnapshot {
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

function applySnapshot(
  list: BiometricSnapshot[],
  incoming: BiometricSnapshot,
): BiometricSnapshot[] {
  const idx = list.findIndex((s) => s.playerId === incoming.playerId);
  if (idx === -1) return [...list, incoming];
  const existing = list[idx];
  const existingTs = existing.recordedAt ? Date.parse(existing.recordedAt) : 0;
  const incomingTs = incoming.recordedAt ? Date.parse(incoming.recordedAt) : 0;
  if (incomingTs < existingTs) return list; // stale — drop
  const next = list.slice();
  next[idx] = incoming;
  return next;
}

export function useBiometricRealtime(
  gameId: string | null,
  initial: BiometricSnapshot[],
): { snapshots: BiometricSnapshot[] } {
  const [snapshots, setSnapshots] = useState<BiometricSnapshot[]>(initial);
  const ref = useRef(initial);
  ref.current = snapshots;

  useEffect(() => {
    setSnapshots(initial);
    ref.current = initial;
  }, [initial]);

  useEffect(() => {
    if (!gameId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const broadcast = supabase
      .channel(`biometrics:${gameId}`)
      .on('broadcast', { event: 'biometric_update' }, (msg) => {
        const row = msg?.payload as Record<string, unknown> | undefined;
        if (!row) return;
        const snap = dbRowToSnapshot(row);
        const next = applySnapshot(ref.current, snap);
        if (next !== ref.current) {
          ref.current = next;
          setSnapshots(next);
        }
      })
      .subscribe();

    // Secondary signal: row-level insert via Realtime.
    const dbRows = supabase
      .channel(`biometrics-db:${gameId}`)
      .on(
        'postgres_changes' as never,
        { event: 'INSERT', schema: 'public', table: 'player_biometric_snapshots', filter: `game_id=eq.${gameId}` } as never,
        (msg: { new?: Record<string, unknown> }) => {
          if (!msg?.new) return;
          const snap = dbRowToSnapshot(msg.new);
          const next = applySnapshot(ref.current, snap);
          if (next !== ref.current) {
            ref.current = next;
            setSnapshots(next);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcast);
      supabase.removeChannel(dbRows);
    };
  }, [gameId]);

  return { snapshots };
}

// Exposed for unit testing the reducer.
export const __applyBiometricSnapshotForTests = applySnapshot;
