import { expect, test, seedSuperAdminSession } from '../playwright-fixture';

const GAME_ID = 'broadcast';
const FACEBOOK_URL = 'https://www.facebook.com/SBBLHQ/videos/123456789/';
const PLAYER_HOST_SELECTOR = '[data-testid="stream-player"]';

async function registerFacebookMocks(page: import('@playwright/test').Page, isLive: boolean = true) {
  await page.route('**/api/public/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, liveGames: [], upcomingGames: [], recentGames: [] }),
    });
  });

  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
        supabaseUrl: 'https://ezanilxygnpucwkwpsoc.supabase.co',
        supabasePublishableKey: 'playwright-publishable-key',
        googleOAuthEnabled: false,
      }),
    });
  });

  await page.route('**/ops/streams/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        config: {
          isLive,
          title: 'Definitive FB Live Stream',
          collectionId: isLive ? FACEBOOK_URL : '',
          source: 'main',
          viewerCount: 2,
        }
      })
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/get_active_broadcast')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_live: isLive,
          stream_url: isLive ? FACEBOOK_URL : null,
          title: 'Definitive FB Live Stream',
          active_game_id: null,
          live_started_at: isLive ? new Date().toISOString() : null,
          requires_payment: true,
          is_subscribed: false,
          has_entitlement: false,
          user_registered: false,
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(`**/api/broadcast/access`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, hasAccess: true }),
    });
  });

  let activeSessionId = 'sess-validation-1';
  await page.route(`**/api/broadcast/session`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        playback: {
          type: 'facebook',
          url: FACEBOOK_URL,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          heartbeatIntervalSec: 1,
        },
        session: {
          id: activeSessionId,
          gameId: null,
          maxExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      }),
    });
  });

  await page.route(`**/api/broadcast/session/heartbeat`, async (route) => {
    if (route.request().headers()['x-test-simulate-displacement']) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'session_not_found', message: 'Session displaced' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
  });
  
  await page.route(`**/api/streams/status**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, isLive, title: 'Definitive FB Live Stream', viewerCount: 2, gameId: null }),
    });
  });

  await page.route('https://www.facebook.com/plugins/video.php*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><div id="mock-fb-player">MOCK FB PLAYER</div></body></html>',
    });
  });
}

test.describe('Definitive Stream Gating Validation', () => {

  test('[evidence:facebook] entitled user sees Facebook iframe correctly mount', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerFacebookMocks(page);

    await page.goto('/live', { waitUntil: 'domcontentloaded' });
    
    await expect(page.locator(PLAYER_HOST_SELECTOR)).toBeVisible({ timeout: 15_000 });
    
    const iframe = page.locator('iframe[title="Facebook Live Stream"]');
    await expect(iframe).toBeVisible();
    
    const src = await iframe.getAttribute('src');
    expect(src).toContain('facebook.com/plugins/video.php');
    expect(src).toContain(encodeURIComponent(FACEBOOK_URL));
  });

  test('[evidence:paywall] unentitled user is blocked by paywall', async ({ page }) => {
    await registerFacebookMocks(page);
    await page.goto('/live', { waitUntil: 'domcontentloaded' });
    
    await expect(page.getByText(/Register to Watch/i)).toBeVisible();
    await expect(page.locator(PLAYER_HOST_SELECTOR)).toHaveCount(0);
  });

  test('[evidence:one-device] concurrent heartbeat fails with session displacement', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerFacebookMocks(page);

    // Override heartbeat to simulate displacement on this device
    await page.route(`**/api/broadcast/session/heartbeat`, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'session_not_found', message: 'Session displaced' }),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded' });
    
    await expect(page.locator(PLAYER_HOST_SELECTOR)).toBeVisible();
    await expect(page.getByText(/Your stream was opened on another device/i)).toBeVisible({ timeout: 15_000 });
  });

});
