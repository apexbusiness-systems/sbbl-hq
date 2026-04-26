import { test, expect } from '../playwright-fixture';

// Adapted from the original recipe: /live does not parse ?league= (it uses an
// internal activeLeagueIdx state, see src/pages/Live.tsx). The league-addressable
// routes in this app are /league/:leagueId (App.tsx:141). Probing those exercises
// distinct league-rendered content while keeping the spirit of "every league tab".
const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/',              label: 'home' },
  { path: '/live',          label: 'live' },
  { path: '/league/sbbl',   label: 'league-sbbl' },
  { path: '/league/wbl',    label: 'league-wbl' },
  { path: '/league/tgifbl', label: 'league-tgifbl' },
];

test.describe('CSP invariant — no violations on key routes', () => {
  for (const { path, label } of ROUTES) {
    test(`${label} (${path}) emits zero CSP violations`, async ({ page, cspWatcher }) => {
      const response = await page.goto(path, { waitUntil: 'networkidle' });
      expect(response, `no response for ${path}`).not.toBeNull();
      expect(response!.status(), `bad status for ${path}`).toBeLessThan(500);
      // Allow render + any async embed mount + any deferred script
      await page.waitForTimeout(2500);
      expect(
        cspWatcher.violations,
        `CSP console violations on ${path}:\n${cspWatcher.violations.join('\n')}`,
      ).toHaveLength(0);
      expect(
        cspWatcher.pageErrors,
        `CSP pageerror on ${path}:\n${cspWatcher.pageErrors.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});
