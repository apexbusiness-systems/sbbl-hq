import { expect, test } from '@playwright/test';

const GAME_ID = 'e2e-preflight-game';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sbbl_test_flags',
      JSON.stringify({ VITE_FEATURE_SHOW_VIEWER_PREFLIGHT: 'true' }),
    );
    // Mock video.play() to prevent headless chromium from hanging on empty src
    HTMLVideoElement.prototype.play = () => Promise.reject(new Error('headless test mock'));
  });

  await page.route('**/api/public/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        // Worker returns top-level fields; fetchPublicHome normalizes into data.
        liveGames: [],
        upcomingGames: [
          {
            id: GAME_ID,
            home_team_id: 'home-team',
            away_team_id: 'away-team',
            home_team: { name: 'Home' },
            away_team: { name: 'Away' },
            league_code: 'SBBL',
            status: 'upcoming',
            scheduled_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route('**/api/public/stream/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, isLive: false, title: 'Test Stream', viewerCount: 0 }),
    });
  });
});

test('viewer preflight renders when enabled', async ({ page }) => {
  await page.route('**/api/streams/**/preflight', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        game: {
          id: GAME_ID,
          title: 'Home vs Away',
          state: 'upcoming',
          tipoffAt: new Date().toISOString(),
          ppvPriceCad: 4.99,
          replay: { embargoEndsAt: null, entitled: false, priceCad: 4.99, qualityTier: 'raw' }
        },
        userId: undefined,
        entitlement: { status: 'none' },
        activeSession: { hasConflict: false },
        session: { signedIn: false, ppvEntitled: false, entitlementHoursRemaining: null },
        stream: { live: false, signedUrlRequired: false },
      }),
    });
  });

  await page.goto('/live');
  await expect(page.getByTestId('viewer-preflight')).toBeVisible({ timeout: 10_000 });
});

test('preflight error state is non-crashing', async ({ page }) => {
  await page.route('**/api/streams/**/preflight', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'boom' }),
    });
  });

  await page.goto('/live');
  await expect(page.getByTestId('preflight-error')).toBeVisible({ timeout: 10_000 });
});
