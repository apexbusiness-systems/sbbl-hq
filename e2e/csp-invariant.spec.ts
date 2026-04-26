import { test, expect } from '../playwright-fixture';

/**
 * CSP invariant — pins zero-CSP-violations as a repo-wide invariant across
 * all key public routes. Any future regression that re-introduces a CSP
 * violation will fail CI on chromium AND webkit.
 */
const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/',     label: 'home' },
  { path: '/live', label: 'live' },
];

test.describe('CSP invariant — no violations on key routes', () => {
  for (const { path, label } of ROUTES) {
    test(`${label} (${path}) emits zero CSP violations`, async ({ page, cspWatcher }) => {
      const response = await page.goto(path, { waitUntil: 'networkidle' });
      expect(response, `no response for ${path}`).not.toBeNull();
      expect(response!.status(), `bad status for ${path}`).toBeLessThan(500);
      await page.waitForTimeout(2500);
      expect(cspWatcher.violations, `CSP console violations on ${path}:\n${cspWatcher.violations.join('\n')}`).toHaveLength(0);
      expect(cspWatcher.pageErrors, `CSP pageerror on ${path}:\n${cspWatcher.pageErrors.join('\n')}`).toHaveLength(0);
    });
  }
});
