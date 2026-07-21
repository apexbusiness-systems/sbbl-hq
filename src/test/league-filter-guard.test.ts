// Source-level guard for the league-resolution consolidation (PR #571).
//
// Before 2026-07-21 the league slug→UUID lookup was hand-rolled independently
// at 8 worker call sites. The copies drifted: one crashed /ops/list/media with
// a Postgres 22P02 → 500 (the incident), one silently degraded /api/teams to
// fetch-all-then-JS-filter, two silently nulled league_id on ingest writes.
// PR #567 had already fixed this exact bug class once — in a single handler —
// proving that point fixes do not stick. The only durable fix is a single
// implementation: resolveLeagueId / resolveLeagueIdFilter in
// src/worker/shared.ts.
//
// This guard fails the build if anyone hand-rolls a 9th copy. If it fired on
// your branch: import the helpers from src/worker/shared.ts instead of
// querying leagues yourself. Do NOT widen the allowlist.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKER_ROOT = join(__dirname, '..', 'worker');

function workerSourceFiles(dir: string = WORKER_ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === 'tests' ? [] : workerSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry) ? [full] : [];
  });
}

describe('league-resolution single source of truth', () => {
  const files = workerSourceFiles().map((path) => ({
    path,
    rel: path.slice(WORKER_ROOT.length + 1),
    src: readFileSync(path, 'utf8'),
  }));

  it('only shared.ts may query leagues by code with ilike', () => {
    const offenders = files.filter(
      (f) => f.rel !== 'shared.ts' && /\.ilike\(\s*["']code["']/.test(f.src),
    );
    expect(
      offenders.map((f) => f.rel),
      'Hand-rolled league code lookup found — use resolveLeagueId/resolveLeagueIdFilter from src/worker/shared.ts',
    ).toEqual([]);
  });

  it('shared.ts contains exactly one code lookup (the canonical resolver)', () => {
    const shared = files.find((f) => f.rel === 'shared.ts');
    expect(shared).toBeDefined();
    expect(shared!.src.match(/\.ilike\(\s*["']code["']/g)).toHaveLength(1);
    expect(shared!.src).toContain('export async function resolveLeagueId');
    expect(shared!.src).toContain('export async function resolveLeagueIdFilter');
    expect(shared!.src).toContain('export const LEAGUE_NO_MATCH');
  });
});
