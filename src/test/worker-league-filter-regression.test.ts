// Regression suite for the 2026-07-21 /ops/media 500 incident (PR #571).
//
// Root cause: frontends send app-level league slugs (e.g. "tgifbl" from
// LEAGUE_REGISTRY), but league_id columns are uuid FKs to leagues.id. Eight
// independent hand-rolled slug→UUID lookups had drifted across the worker;
// the /ops/list/media one passed the slug straight into .eq('league_id', slug)
// → Postgres 22P02 "invalid input syntax for type uuid" → 500 on every league
// filter chip in the ops console. GET /api/teams had the silent-degradation
// variant (fetch all rows, filter in JS).
//
// These tests pin the consolidated resolver (src/worker/shared.ts):
//   - slug input resolves to the leagues.id UUID before any league_id filter
//   - a UUID input passes through without a lookup
//   - an unknown slug yields zero rows (LEAGUE_NO_MATCH) — visible empty
//     state, never a crash, never a silently-dropped filter
import { describe, expect, it } from 'vitest';
import {
  LEAGUE_NO_MATCH,
  LEAGUE_UUID_RE,
  resolveLeagueId,
  resolveLeagueIdFilter,
} from '@/worker/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const TGIF_UUID = '11111111-1111-4111-8111-111111111111';

// Minimal admin stub backing the leagues table. Records every filter the
// resolver issues so tests can assert the exact lookup shape.
function stubAdmin(rows: Array<{ id: string; code: string; name: string }>) {
  const lookups: Array<{ column: string; pattern: string }> = [];
  const admin = {
    from: (table: string) => {
      if (table !== 'leagues') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          ilike: (column: string, pattern: string) => ({
            maybeSingle: () => {
              lookups.push({ column, pattern });
              const hit = rows.find(
                (r) =>
                  String(r[column as 'code' | 'name'] ?? '').toLowerCase() ===
                  pattern.toLowerCase(),
              );
              return Promise.resolve({ data: hit ? { id: hit.id } : null, error: null });
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { admin, lookups };
}

const LEAGUES = [
  { id: TGIF_UUID, code: 'tgifbl', name: 'TGIF Basketball League' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'wbl', name: 'Weekend Basketball League' },
];

describe('resolveLeagueId — slug/code/name → leagues.id UUID', () => {
  it('resolves a LEAGUE_REGISTRY slug to the league UUID (the incident case)', async () => {
    const { admin, lookups } = stubAdmin(LEAGUES);
    await expect(resolveLeagueId(admin, 'tgifbl')).resolves.toBe(TGIF_UUID);
    expect(lookups).toEqual([{ column: 'code', pattern: 'tgifbl' }]);
  });

  it('is case-insensitive on code', async () => {
    const { admin } = stubAdmin(LEAGUES);
    await expect(resolveLeagueId(admin, 'TGIFBL')).resolves.toBe(TGIF_UUID);
  });

  it('passes a UUID through without any DB lookup', async () => {
    const { admin, lookups } = stubAdmin(LEAGUES);
    await expect(resolveLeagueId(admin, TGIF_UUID)).resolves.toBe(TGIF_UUID);
    expect(lookups).toHaveLength(0);
  });

  it('falls back to league name (legacy /api/teams parity)', async () => {
    const { admin, lookups } = stubAdmin(LEAGUES);
    await expect(
      resolveLeagueId(admin, 'Weekend Basketball League'),
    ).resolves.toBe('22222222-2222-4222-8222-222222222222');
    expect(lookups.map((l) => l.column)).toEqual(['code', 'name']);
  });

  it('returns null for an unknown league — never the raw slug', async () => {
    const { admin } = stubAdmin(LEAGUES);
    await expect(resolveLeagueId(admin, 'not-a-league')).resolves.toBeNull();
  });

  it('throws on a DB error instead of silently nulling the league', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(resolveLeagueId(admin, 'tgifbl')).rejects.toThrow('boom');
  });
});

describe('resolveLeagueIdFilter — list-endpoint semantics', () => {
  it('returns null when no filter was requested', async () => {
    const { admin, lookups } = stubAdmin(LEAGUES);
    await expect(resolveLeagueIdFilter(admin, null)).resolves.toBeNull();
    expect(lookups).toHaveLength(0);
  });

  it('resolves a slug filter to the UUID', async () => {
    const { admin } = stubAdmin(LEAGUES);
    await expect(resolveLeagueIdFilter(admin, 'tgifbl')).resolves.toBe(TGIF_UUID);
  });

  it('returns LEAGUE_NO_MATCH (zero rows), not a crash, for an unknown slug', async () => {
    const { admin } = stubAdmin(LEAGUES);
    await expect(resolveLeagueIdFilter(admin, 'ghost-league')).resolves.toBe(LEAGUE_NO_MATCH);
  });
});

describe('LEAGUE_UUID_RE', () => {
  it('accepts canonical UUIDs and rejects every registry slug', () => {
    expect(LEAGUE_UUID_RE.test(TGIF_UUID)).toBe(true);
    for (const slug of ['wbl', 'sbbl', 'tgifbl', 'broadcast']) {
      expect(LEAGUE_UUID_RE.test(slug)).toBe(false);
    }
  });
});
