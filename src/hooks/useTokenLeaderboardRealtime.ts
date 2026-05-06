/**
 * Realtime subscription hook for the fan-token leaderboard.
 *
 * Subscribes to the `tokens:{gameId}` Supabase broadcast channel and
 * returns a local reducer on `leaderboard_update` events. Reusable by
 * future WS5 biometrics (same hook shape, different channel name) to
 * keep realtime consumer boilerplate in one place.
 *
 * Invariants:
 *   - Channel is (un)subscribed on gameId change or unmount.
 *   - Ordering: after each delta the list is re-sorted by totalTokens
 *     desc. The reducer never mutates — always returns a new array
 *     so React Query + SWR-style caches see reference changes.
 *   - No-op when gameId is null (safe to call on non-live pages).
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { LeaderboardEntry } from '@/lib/tokens/types';

export interface LeaderboardUpdate {
  playerId: string;
  amount: number;
  categorySlug: string;
  total: number;
}

function applyUpdate(list: LeaderboardEntry[], u: LeaderboardUpdate): LeaderboardEntry[] {
  const idx = list.findIndex((e) => e.playerId === u.playerId);
  const next: LeaderboardEntry[] = idx >= 0 ? list.slice() : [...list];
  if (idx >= 0) {
    const existing = next[idx];
    next[idx] = {
      ...existing,
      totalTokens: u.total,
      categoryBreakdown: {
        ...existing.categoryBreakdown,
        [u.categorySlug]: (existing.categoryBreakdown[u.categorySlug] ?? 0) + u.amount,
      },
      lastUpdated: new Date().toISOString(),
    };
  } else {
    next.push({
      playerId: u.playerId,
      totalTokens: u.total,
      categoryBreakdown: { [u.categorySlug]: u.amount },
      lastUpdated: new Date().toISOString(),
    });
  }
  next.sort((a, b) => b.totalTokens - a.totalTokens);
  return next;
}

export function useTokenLeaderboardRealtime(
  gameId: string | null,
  initial: LeaderboardEntry[],
): { entries: LeaderboardEntry[]; lastUpdate: LeaderboardUpdate | null } {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);
  const [lastUpdate, setLastUpdate] = useState<LeaderboardUpdate | null>(null);
  // Keep latest entries in a ref so the channel handler closes over a
  // stable reference and we don't re-subscribe on every re-render.
  const entriesRef = useRef(initial);
  entriesRef.current = entries;

  useEffect(() => {
    // Hydrate from fresh initial prop whenever it changes (gameId switch).
    setEntries(initial);
    entriesRef.current = initial;
  }, [initial]);

  useEffect(() => {
    if (!gameId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase.channel(`tokens:${gameId}`);
    channel
      .on('broadcast', { event: 'leaderboard_update' }, (payload) => {
        const data = payload?.payload as LeaderboardUpdate | undefined;
        if (!data || typeof data.total !== 'number') return;
        const next = applyUpdate(entriesRef.current, data);
        entriesRef.current = next;
        setEntries(next);
        setLastUpdate(data);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { entries, lastUpdate };
}

// Exposed for unit testing the reducer without a Supabase client.
export const __applyLeaderboardUpdateForTests = applyUpdate;
