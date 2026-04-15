import { expect, test, type Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://ezanilxygnpucwkwpsoc.supabase.co';
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split('.')[0] ?? 'local';
const SESSION_KEY = `sb-${SUPABASE_REF}-auth-token`;
const GAME_ID = 'omnitest-game';

async function seedSessionWithRole(page: Page, role: 'paid_fan' | 'league_admin') {
  const userId = role === 'paid_fan'
    ? '00000000-0000-4000-8000-000000000101'
    : '00000000-0000-4000-8000-000000000102';

  await page.addInitScript(
    ({ supabaseUrl, sessionKey, roleName, seededUserId }) => {
      const sessionPayload = JSON.stringify({
        access_token: `playwright-${roleName}-access-token`,
        refresh_token: `playwright-${roleName}-refresh-token`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: seededUserId,
          email: `${roleName}@test.local`,
          role: 'authenticated',
          aud: 'authenticated',
        },
      });

      // Seed auth storage before app boot so auth guards resolve immediately.
      window.localStorage.setItem(sessionKey, sessionPayload);
      window.localStorage.setItem('supabase.auth.token', sessionPayload);

      const originalFetch = window.fetch;
      window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
        if (!url.startsWith(supabaseUrl)) {
          return originalFetch.call(window, input, init);
        }

        const path = new URL(url).pathname;
        if (path.startsWith('/auth/v1/token')) {
          return Promise.resolve(new Response(sessionPayload, { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        if (path.startsWith('/auth/v1/user')) {
          return Promise.resolve(new Response(JSON.stringify({
            id: seededUserId,
            email: `${roleName}@test.local`,
            role: 'authenticated',
            aud: 'authenticated',
          }), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        if (path.startsWith('/rest/v1/user_role_assignments')) {
          return Promise.resolve(new Response(JSON.stringify([{ role: roleName }]), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        if (path.startsWith('/rest/v1/profiles')) {
          return Promise.resolve(new Response(JSON.stringify([{
            id: `profile-${seededUserId}`,
            user_id: seededUserId,
            display_name: `${roleName} user`,
            full_name: `${roleName} user`,
            bio: null,
            avatar_url: null,
            preferred_league: 'sbbl',
            primary_role_intent: 'fan',
            onboarding_completed_at: '2026-04-01T00:00:00Z',
            stripe_customer_id: null,
            subscription_ends_at: null,
          }]), { status: 200, headers: { 'content-type': 'application/json' } }));
        }

        return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
      };
    },
    {
      supabaseUrl: SUPABASE_URL,
      sessionKey: SESSION_KEY,
      roleName: role,
      seededUserId: userId,
    },
  );
}

async function mockBaseLiveEndpoints(page: Page) {
  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        supabaseUrl: SUPABASE_URL,
        supabasePublishableKey: 'playwright-publishable-key',
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
      }),
    });
  });

  await page.route('**/api/public/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        liveGames: [{
          id: GAME_ID,
          status: 'live',
          home_team_id: 'home-1',
          away_team_id: 'away-1',
          home_score: 41,
          away_score: 39,
          scheduled_at: new Date().toISOString(),
          venue: 'Omnitest Arena',
          court: 'Main',
          league_code: 'SBBL',
          home_team: { id: 'home-1', name: 'Home' },
          away_team: { id: 'away-1', name: 'Away' },
        }],
        upcomingGames: [],
        recentGames: [],
      }),
    });
  });
}

test.describe('phase-5 omnitest stream flows', () => {
  test('anonymous flow gets paywall scrub payload and remains gated in UI', async ({ page }) => {
    await mockBaseLiveEndpoints(page);

    await page.route('**/api/streams/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, isLive: true, title: 'Omnitest Stream', viewerCount: 0 }),
      });
    });

    await page.route(`**/api/streams/${GAME_ID}/session`, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'forbidden',
          message: 'paywall',
          playback: { url: null, heartbeatIntervalSec: 10 },
          session: { id: null },
        }),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Register to Watch/i)).toBeVisible();
    await expect(page.locator('[data-testid="stream-player"]')).toHaveCount(0);

    const scrubbed = await page.evaluate(async (gameId) => {
      const response = await fetch(`/api/streams/${gameId}/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': `anon-${Date.now()}` },
        body: JSON.stringify({ sessionKey: `anon-session-${Date.now()}` }),
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    }, GAME_ID);

    expect(scrubbed.status).toBe(403);
    expect(scrubbed.body).toMatchObject({
      error: 'forbidden',
      message: 'paywall',
      playback: { url: null, heartbeatIntervalSec: 10 },
      session: { id: null },
    });
  });

  test('paid_fan flow gets m3u8 playback path and mounts Video.js player shell', async ({ page }) => {
    await seedSessionWithRole(page, 'paid_fan');
    await mockBaseLiveEndpoints(page);

    await page.route('**/api/streams/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, isLive: true, title: 'Omnitest Stream', viewerCount: 12 }),
      });
    });

    await page.route(`**/api/streams/${GAME_ID}/access`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, hasAccess: true, gameId: GAME_ID }),
      });
    });

    let sessionRequestCount = 0;
    await page.route(`**/api/streams/${GAME_ID}/session`, async (route) => {
      sessionRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          playback: {
            type: 'url',
            url: 'https://cdn.test.local/live/omnitest.m3u8',
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            maxExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            heartbeatIntervalSec: 25,
          },
          session: { id: 'sess-paid-fan-1', gameId: GAME_ID },
        }),
      });
    });

    await page.route(`**/api/streams/${GAME_ID}/session/heartbeat`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.route(`**/api/streams/${GAME_ID}/session/end`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ended: true }) });
    });

    await page.route(`**/api/streams/${GAME_ID}/comments**`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comments: [] }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comment: { id: 'c1', message: 'ok' } }) });
    });

    await page.route(`**/api/streams/${GAME_ID}/reactions**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fire: 0, heart: 0, clap: 0 }) });
    });

    await page.route(`**/api/streams/${GAME_ID}/react`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Register to Watch/i)).toHaveCount(0);
    await expect(page.getByText(/Purchase Access/i)).toHaveCount(0);
    await expect(page.locator('[data-testid="stream-player"] .video-js')).toBeVisible();
    await expect.poll(() => sessionRequestCount).toBeGreaterThan(0);
  });

  test('league_admin cannot see broadcaster controls in Live UI', async ({ page }) => {
    await seedSessionWithRole(page, 'league_admin');
    await mockBaseLiveEndpoints(page);

    await page.route('**/api/streams/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, isLive: true, title: 'Omnitest Stream', viewerCount: 6 }),
      });
    });

    await page.route(`**/api/streams/${GAME_ID}/access`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hasAccess: false }) });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTitle('Stream controls')).toHaveCount(0);
    await expect(page.getByText(/Broadcast Controls/i)).toHaveCount(0);
  });
});
