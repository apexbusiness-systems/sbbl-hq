/**
 * Token leaderboard realtime reducer — pure-function tests.
 *
 * The reducer is isolated from Supabase so realtime wiring is fully
 * testable without a live socket. Reducer invariants:
 *   - Append for a new playerId, update in place for an existing one.
 *   - category_breakdown accumulates per-category tokens.
 *   - Result list is always sorted by totalTokens desc (tie-break by
 *     insertion order, i.e. stable sort).
 *   - Input list is never mutated.
 */
import { describe, expect, it } from 'vitest';
import { __applyLeaderboardUpdateForTests as apply } from '@/hooks/useTokenLeaderboardRealtime';
import type { LeaderboardEntry } from '@/lib/tokens/types';

function e(playerId: string, total: number, breakdown: Record<string, number> = {}): LeaderboardEntry {
  return {
    playerId,
    totalTokens: total,
    categoryBreakdown: breakdown,
    lastUpdated: '2026-04-18T00:00:00Z',
  };
}

describe('leaderboard reducer — apply', () => {
  it('inserts a new player', () => {
    const next = apply([], { playerId: 'p1', amount: 5, categorySlug: 'fan_favorite', total: 5 });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      playerId: 'p1',
      totalTokens: 5,
      categoryBreakdown: { fan_favorite: 5 },
    });
  });

  it('updates existing player totals and category breakdown', () => {
    const initial = [e('p1', 10, { fan_favorite: 10 })];
    const next = apply(initial, {
      playerId: 'p1', amount: 3, categorySlug: 'most_hype', total: 13,
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      playerId: 'p1',
      totalTokens: 13,
      categoryBreakdown: { fan_favorite: 10, most_hype: 3 },
    });
  });

  it('re-sorts to descending totals after a delta promotes a rival', () => {
    const initial = [e('p1', 100), e('p2', 50), e('p3', 25)];
    const next = apply(initial, {
      playerId: 'p3', amount: 200, categorySlug: 'clutch_factor', total: 225,
    });
    expect(next.map((r) => r.playerId)).toEqual(['p3', 'p1', 'p2']);
  });

  it('does not mutate input list', () => {
    const initial = [e('p1', 10)];
    const snapshot = JSON.stringify(initial);
    apply(initial, { playerId: 'p1', amount: 5, categorySlug: 'fan_favorite', total: 15 });
    expect(JSON.stringify(initial)).toBe(snapshot);
  });

  it('accumulates the same category on repeat awards', () => {
    const initial = [e('p1', 5, { fan_favorite: 5 })];
    const next = apply(initial, {
      playerId: 'p1', amount: 5, categorySlug: 'fan_favorite', total: 10,
    });
    expect(next[0].categoryBreakdown.fan_favorite).toBe(10);
  });
});
