import { expect, test as base, type ConsoleMessage, type Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://ezanilxygnpucwkwpsoc.supabase.co';
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split('.')[0] ?? 'local';
const SESSION_KEY = `sb-${SUPABASE_REF}-auth-token`;
const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_EMAIL = 'ops-super-admin@test.local';

type CSPFixtures = {
  cspWatcher: { violations: string[]; pageErrors: string[] };
};

const CSP_PATTERN = /content security policy|script-src|frame-src|worker-src|connect-src|style-src|img-src|media-src|refused to (load|execute|connect|frame)/i;

export const test = base.extend<CSPFixtures>({
  cspWatcher: async ({ page }, use, testInfo) => {
    const violations: string[] = [];
    const pageErrors: string[] = [];
    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() === 'error' && CSP_PATTERN.test(msg.text())) {
        violations.push(msg.text());
      }
    };
    const onPageError = (err: Error) => {
      if (CSP_PATTERN.test(err.message)) pageErrors.push(err.message);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    await use({ violations, pageErrors });

    page.off('console', onConsole);
    page.off('pageerror', onPageError);

    if (violations.length || pageErrors.length) {
      await testInfo.attach('csp-violations', {
        body: JSON.stringify({ violations, pageErrors }, null, 2),
        contentType: 'application/json',
      });
    }
  },
});

/**
 * Seed a deterministic super-admin Supabase session so auth guards pass.
 *
 * Uses `addInitScript` for TWO purposes:
 *   1. Inject the session into localStorage before the Supabase client boots.
 *   2. Monkey-patch `window.fetch` to intercept all Supabase API calls at the
 *      JS level — this is immune to service-worker and CDP timing issues that
 *      cause Playwright's `page.route()` to intermittently miss requests.
 */
export async function seedSuperAdminSession(page: Page) {
  await page.addInitScript(
    ({ supabaseUrl, sessionKey, sessionPayload, fakeUser, fakeSession, fakeProfile }) => {
      // ── 1. Seed localStorage so Supabase client recovers the session ──────
      try {
        window.localStorage.setItem(sessionKey, sessionPayload);
        window.localStorage.setItem('supabase.auth.token', sessionPayload);
      } catch { /* noop */ }

      // ── 2. Monkey-patch fetch to intercept Supabase API calls ─────────────
      const _origFetch = window.fetch;
      window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

        if (url.startsWith(supabaseUrl)) {
          const path = new URL(url).pathname;

          if (path.startsWith('/auth/v1/token')) {
            return Promise.resolve(new Response(JSON.stringify(fakeSession), { status: 200, headers: { 'content-type': 'application/json' } }));
          }
          if (path.startsWith('/auth/v1/user')) {
            return Promise.resolve(new Response(JSON.stringify(fakeUser), { status: 200, headers: { 'content-type': 'application/json' } }));
          }
          if (path.startsWith('/rest/v1/user_role_assignments')) {
            return Promise.resolve(new Response(JSON.stringify([{ role: 'super_admin' }]), { status: 200, headers: { 'content-type': 'application/json' } }));
          }
          if (path.startsWith('/rest/v1/profiles')) {
            const accept = (init?.headers as Record<string, string>)?.['Accept']
              ?? (init?.headers instanceof Headers ? init.headers.get('Accept') : '') ?? '';
            const body = accept.includes('application/vnd.pgrst.object+json')
              ? JSON.stringify(fakeProfile)
              : JSON.stringify([fakeProfile]);
            return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
          }

          // Catch-all for any other Supabase request
          return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
        }

        // Non-Supabase requests pass through
        return _origFetch.call(window, input, init);
      };
    },
    {
      supabaseUrl: SUPABASE_URL,
      sessionKey: SESSION_KEY,
      sessionPayload: JSON.stringify({
        access_token: 'playwright-access-token',
        refresh_token: 'playwright-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: DEFAULT_USER_ID,
          email: DEFAULT_EMAIL,
          role: 'authenticated',
          aud: 'authenticated',
        },
      }),
      fakeUser: {
        id: DEFAULT_USER_ID,
        email: DEFAULT_EMAIL,
        role: 'authenticated',
        aud: 'authenticated',
      },
      fakeSession: {
        access_token: 'playwright-access-token',
        refresh_token: 'playwright-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: DEFAULT_USER_ID,
          email: DEFAULT_EMAIL,
          role: 'authenticated',
          aud: 'authenticated',
        },
      },
      fakeProfile: {
        id: 'profile-1',
        user_id: DEFAULT_USER_ID,
        display_name: 'Ops Super Admin',
        full_name: 'Ops Super Admin',
        bio: null,
        avatar_url: null,
        preferred_league: 'sbbl',
        primary_role_intent: 'admin',
        onboarding_completed_at: '2026-04-09T00:00:00Z',
        stripe_customer_id: null,
        subscription_ends_at: null,
      },
    },
  );

  // Ops pipeline-health probe (2026-07-20): the Overview tab polls this on a
  // 60s interval. Left unmocked, the dev server's response churns the page and
  // destabilizes locators — every seeded session gets a healthy default.
  await page.route('**/ops/pipeline/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        overall: 'ok',
        metrics: {
          outbox_pending: { value: 0, warn: 25, critical: 100, status: 'ok' },
          outbox_oldest_minutes: { value: 0, warn: 10, critical: 60, status: 'ok' },
          outbox_dead_letters: { value: 0, warn: 1, critical: 5, status: 'ok' },
          ingress_failed_24h: { value: 0, warn: 5, critical: 25, status: 'ok' },
          import_failed_rows_24h: { value: 0, warn: 10, critical: 50, status: 'ok' },
        },
        alerts: [],
        checked_at: new Date().toISOString(),
      }),
    }),
  );

  // Also intercept /api/public-config via page.route (local dev server, no CDP issue)
  await page.route('**/api/public-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        supabaseUrl: SUPABASE_URL,
        supabasePublishableKey: 'playwright-publishable-key',
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
      }),
    }),
  );
}

export { expect };
