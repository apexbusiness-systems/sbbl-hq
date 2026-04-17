/**
 * Production DB/data-availability proof.
 *
 * Visual UI validation requires the branch to be deployed (Cloudflare
 * Workers + Pages) — which happens only after this PR is merged. This
 * spec proves the HALF of the fix that IS live today (the Supabase
 * migrations + the seeded catalog) by hitting already-deployed public
 * endpoints and asserting real, populated data.
 *
 * Run:
 *   npx playwright test e2e/live-data-visual-proof.spec.ts --project=chromium
 *
 * The other half — tier-gated /api/stats + /api/leaderboards + the
 * Profiles.tsx wiring fix — is validated by:
 *   • src/test/stats-tier-gating.test.ts (vitest, full handler E2E)
 *   • src/test/public-data-pipeline.test.ts (contract assertions)
 * both of which run in CI.
 *
 * NOTE: These tests are skipped in CI because they hit the live production
 * API at https://sbbl-hq.icu, which is not accessible from GitHub Actions
 * runners (Cloudflare blocks non-allowlisted IPs). Run manually after merge
 * to verify production data availability end-to-end.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE ?? 'https://sbbl-hq.icu';

// Sandbox proxies re-sign HTTPS with a local CA; trust them for this run.
test.use({ ignoreHTTPSErrors: true });

test.describe('production public APIs return populated live data', () => {
  // Skip in CI: these tests call https://sbbl-hq.icu directly which is not
  // reachable from GitHub Actions runners. Run manually post-merge.
  test.skip(
    !!process.env.CI,
    'Production API proof — GitHub Actions cannot reach sbbl-hq.icu. Run manually after merge.',
  );

  test('GET /api/public/products returns the seeded catalog (\u226510 items)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/public/products`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Before today's seed this endpoint returned []. After the migration
    // it returns at least the 6 retail + 6 custom items (12 total).
    expect(body.data.length).toBeGreaterThanOrEqual(10);
    const names: string[] = body.data.map((p: { name: string }) => p.name);
    expect(names).toContain('SBBL HQ Official Jersey');
    expect(names).toContain('APEX Hoodie');
  });

  test('GET /api/public/potg returns published POTG cards', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/public/potg`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/public/home?league=TGIFBL returns teams + games', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/public/home?league=TGIFBL`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.teams)).toBe(true);
    // 38 teams published across 3 leagues (all statuses). TGIFBL has ~18.
    expect(body.totalTeams).toBeGreaterThan(0);
  });

  test('GET /api/teams returns 38 published teams', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/teams`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.teams)).toBe(true);
    expect(body.teams.length).toBeGreaterThanOrEqual(30);
  });

  test('GET /api/scores returns a games list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/scores`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.games)).toBe(true);
  });
});
