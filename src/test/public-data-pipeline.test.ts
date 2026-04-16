/**
 * Public-data pipeline contract tests.
 *
 * Companion to docs/protocols/no-mock-in-production.md.
 *
 * Asserts two structural invariants at the worker/API boundary:
 *
 *   1. Every endpoint consumed by anonymous-accessible pages is registered
 *      under /api/public/* OR /api/{scores,teams} (the other two paths that
 *      are public by convention).
 *
 *   2. The handlers behind the public stats/leaderboards routes do NOT call
 *      `requireAuth(req)` — if they ever do, anonymous users will get 401
 *      and see empty data (which triggered the 2026-04-16 regression).
 *
 *   3. The response shapes for /api/public/stats and /api/public/leaderboards
 *      return an array at `.data` (not a wrapped object) so that callers can
 *      do `Array.isArray(res.data)` without unwrapping.
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

describe('public data pipeline — route registration', () => {
  const publicRoutes: Array<[string, string]> = [
    ['"GET"', '"/api/public/stats"'],
    ['"GET"', '"/api/public/leaderboards"'],
    ['"GET"', '"/api/public/potg"'],
    ['"GET"', '"/api/public/home"'],
    ['"GET"', '"/api/public/schedule"'],
    ['"GET"', '"/api/public/products"'],
    ['"GET"', '"/api/scores"'],
    ['"GET"', '"/api/teams"'],
  ];

  publicRoutes.forEach(([method, path]) => {
    it(`registers ${method} ${path}`, () => {
      expect(workerSrc).toContain(method);
      expect(workerSrc).toContain(path);
    });
  });
});

describe('public data pipeline — handlers are anonymous', () => {
  const publicHandlers = [
    'handlePublicStats',
    'handlePublicLeaderboards',
  ];

  publicHandlers.forEach((name) => {
    it(`${name} does not call requireAuth`, () => {
      const body = handlerBody(name);
      expect(body).not.toMatch(/requireAuth\s*\(\s*req\s*\)/);
    });
  });
});

describe('public data pipeline — response shape is a flat array', () => {
  it('handlePublicStats returns `{ ok, data: Player[] }`', () => {
    const body = handlerBody('handlePublicStats');
    // Must use normalizePublicPlayerRow AND return `data: players` (not a
    // wrapped RPC payload).
    expect(body).toContain('normalizePublicPlayerRow');
    expect(body).toMatch(/data:\s*players/);
  });

  it('handlePublicLeaderboards returns `{ ok, data: Player[] }`', () => {
    const body = handlerBody('handlePublicLeaderboards');
    expect(body).toContain('normalizePublicPlayerRow');
    expect(body).toMatch(/data:\s*players/);
  });
});

describe('public data pipeline — frontend consumes public endpoints', () => {
  const expectations: Array<[string, string]> = [
    ['pages/Stats.tsx', '/api/public/stats'],
    ['pages/Leaderboards.tsx', '/api/public/leaderboards'],
  ];

  expectations.forEach(([file, endpoint]) => {
    it(`${file} fetches from ${endpoint}`, () => {
      const src = readFileSync(
        resolve(__dirname, '..', file),
        'utf-8',
      );
      expect(src).toContain(endpoint);
    });
  });
});
