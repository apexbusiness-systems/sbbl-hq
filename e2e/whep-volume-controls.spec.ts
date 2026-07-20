import { expect, test, seedSuperAdminSession } from '../playwright-fixture';

test('WhepPlayer renders with native controls', async ({ page, context }) => {
  // 1. Seed auth
  await seedSuperAdminSession(context);

  // 2. Mock configuration
  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
        supabaseUrl: 'https://ezanilxygnpucwkwpsoc.supabase.co',
        supabasePublishableKey: 'mock',
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
          isLive: true,
          title: 'Definitive WHEP Live Stream',
          collectionId: '',
          source: 'main',
          viewerCount: 2,
        }
      })
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(`**/api/broadcast/access`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, hasAccess: true }),
    });
  });

  await page.route(`**/api/broadcast/session`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        playback: {
          url: 'https://live.sbbl-hq.icu/whep/stream',
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          heartbeatIntervalSec: 10,
        },
        session: {
          id: 'mock-session-1',
          gameId: null,
          maxExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      }),
    });
  });

  // Mock the WHEP connection endpoint so it doesn't fail immediately
  await page.route('https://live.sbbl-hq.icu/whep/stream', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/sdp',
      body: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\n',
      headers: {
        'Location': 'https://live.sbbl-hq.icu/whep/stream/12345',
        'Access-Control-Expose-Headers': 'Location',
      }
    });
  });

  // 3. Navigate to live page
  await page.goto('/live');

  // 4. Verify the player container mounts
  const playerContainer = page.locator('[data-testid="stream-player"]');
  await expect(playerContainer).toBeVisible({ timeout: 10000 });

  // 5. Check that the video tag is rendered and has the `controls` property
  const video = page.locator('video');
  await expect(video).toBeVisible();

  const hasControls = await video.evaluate((node: HTMLVideoElement) => node.hasAttribute('controls'));
  expect(hasControls).toBe(false, "Video element must NOT have the 'controls' attribute (using custom control bar)");

  // 6. Check that the custom volume control slider exists in the custom control bar
  const volumeSlider = page.locator('input[type="range"][aria-label="Volume"]');
  await expect(volumeSlider).toBeAttached();
});
