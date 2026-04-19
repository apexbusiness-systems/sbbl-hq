import { expect, test } from '@playwright/test';

const GAME_ID = 'e2e-preflight-game';

function mockHomeWithUpcomingGame() {
  return {
    ok: true,
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
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/public/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHomeWithUpcomingGame()),
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
        },
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
