/**
 * Data-pipeline contract tests — structural assertions for Stats and
 * Leaderboards wiring.
 *
 * Companion to docs/protocols/no-mock-in-production.md and
 * docs/protocols/stats-tier-gating.md. See those docs for the full access
 * matrix.
 *
 * What this file verifies:
 *
 *   1. The route table registers the correct endpoints.
 *   2. handleStats normalises the RPC output and returns `{ok, tier, data}`.
 *   3. handleLeaderboards enforces tier==='full' (403 otherwise) and returns
 *      `{ok, tier, data}` with a flat array at `.data`.
 *   4. Neither handler falls back to the raw RPC wrapped object — the
 *      2026-04-16 regression was caused by shape mismatch between RPC
 *      `{ok, players:[]}` and frontend expectations.
 *   5. The Stats and Leaderboards pages consume the authoritative routes.
 *   6. The public-stats / public-leaderboards routes do NOT exist — all
 *      stat gating is centralised in /api/stats and /api/leaderboards.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workerSrc = readFileSync(
  resolve(__dirname, '..', 'worker', 'index.ts'),
  'utf-8',
);

function handlerBody(name: string): string {
  const start = workerSrc.indexOf(`async function ${name}`);
  if (start < 0) throw new Error(`handler not found: ${name}`);
  const end = workerSrc.indexOf('\nasync function ', start + 10);
  return workerSrc.slice(start, end === -1 ? workerSrc.length : end);
}

describe('data pipeline — route table', () => {
  const registered: Array<[string, string]> = [
    ['"GET"', '"/api/stats"'],
    ['"GET"', '"/api/leaderboards"'],
    ['"GET"', '"/api/public/potg"'],
    ['"GET"', '"/api/public/home"'],
    ['"GET"', '"/api/public/schedule"'],
    ['"GET"', '"/api/public/products"'],
    ['"GET"', '"/api/scores"'],
    ['"GET"', '"/api/teams"'],
  ];

  registered.forEach(([method, path]) => {
    it(`registers ${method} ${path}`, () => {
      expect(workerSrc).toContain(method);
      expect(workerSrc).toContain(path);
    });
  });

  it('does NOT register /api/public/stats (tier logic lives in /api/stats)', () => {
    expect(workerSrc).not.toContain('"/api/public/stats"');
  });

  it('does NOT register /api/public/leaderboards (tier logic lives in /api/leaderboards)', () => {
    expect(workerSrc).not.toContain('"/api/public/leaderboards"');
  });
});

describe('data pipeline — /api/stats handler', () => {
  const body = handlerBody('handleStats');

  it('computes a tier via computeStatAccessTier', () => {
    expect(body).toContain('computeStatAccessTier(');
  });

  it('normalises rows with normalizePublicPlayerRow', () => {
    expect(body).toContain('normalizePublicPlayerRow');
  });

  it('applies the tier filter with applyStatTier', () => {
    expect(body).toContain('applyStatTier');
  });

  it('returns `data: players` — a flat array, not the wrapped RPC object', () => {
    expect(body).toMatch(/data:\s*players/);
  });
});

describe('data pipeline — /api/leaderboards handler', () => {
  const body = handlerBody('handleLeaderboards');

  it('computes a tier via computeStatAccessTier', () => {
    expect(body).toContain('computeStatAccessTier(');
  });

  it('returns 403 when tier is not full', () => {
    // Must reject non-paid / anonymous viewers at the boundary.
    expect(body).toMatch(/tier\s*!==\s*['"]full['"]/);
    expect(body).toMatch(/\{\s*ok:\s*false,\s*error:\s*["']forbidden["']\s*\}/);
    expect(body).toContain('403');
  });

  it('uses get_stats_dashboard (not get_leaderboards) for full stat line', () => {
    // get_leaderboards only returns pts/reb/ast — would break STL/BLK/FLS/MIN tabs.
    expect(body).toContain("rpc(\"get_stats_dashboard\"");
  });

  it('returns `data: players` at the top level', () => {
    expect(body).toMatch(/data:\s*players/);
  });
});

describe('data pipeline — access tier helper', () => {
  const body = handlerBody('computeStatAccessTier');

  it('grants "full" to privileged roles', () => {
    // The helper must check FULL_STAT_ROLES (super_admin, league_admin,
    // coach, team_manager) before any other branch.
    expect(body).toContain('FULL_STAT_ROLES');
    expect(body).toMatch(/tier:\s*['"]full['"]/);
  });

  it('grants "full" to players with an active subscription', () => {
    expect(body).toContain('subscription_ends_at');
    expect(body).toContain('profiles');
  });

  it('defaults anonymous and fan/expired viewers to "minimal"', () => {
    expect(body).toMatch(/tier:\s*['"]minimal['"]/);
  });
});

describe('data pipeline — applyStatTier stripping', () => {
  const workerHeaderWindow = workerSrc.slice(
    workerSrc.indexOf('function applyStatTier'),
    workerSrc.indexOf('function applyStatTier') + 400,
  );

  it('strips gated fields by keeping only pts/reb/ast for non-full tiers', () => {
    expect(workerHeaderWindow).toMatch(/\{\s*pts,\s*reb,\s*ast\s*\}/);
  });
});

describe('data pipeline — frontend consumers', () => {
  const expectations: Array<[string, string]> = [
    ['pages/Stats.tsx', "'/api/stats'"],
    ['pages/Leaderboards.tsx', "'/api/leaderboards'"],
  ];

  expectations.forEach(([file, endpoint]) => {
    it(`${file} fetches from ${endpoint}`, () => {
      const src = readFileSync(resolve(__dirname, '..', file), 'utf-8');
      expect(src).toContain(endpoint);
    });
  });

  it('Leaderboards.tsx renders a gate when unauthorised', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'pages', 'Leaderboards.tsx'),
      'utf-8',
    );
    expect(src).toContain('isGated');
    expect(src).toContain('Leaderboards locked');
  });

  it('Stats.tsx consumes the tier field and trims statKeys to minimal when minimal', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'pages', 'Stats.tsx'),
      'utf-8',
    );
    expect(src).toContain('MINIMAL_STAT_KEYS');
    expect(src).toContain('FULL_STAT_KEYS');
    expect(src).toMatch(/tier\s*===\s*['"]full['"]/);
  });
});
