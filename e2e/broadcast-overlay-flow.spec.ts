/**
 * E2E: broadcast overlay flow.
 *
 * Verifies — under real Vite dev server + React Router + lazy-loaded chunks —
 * that the four new surfaces built in this PR actually mount and render:
 *   1. /overlay/:gameId — OBS chromeless scoreboard page
 *   2. /scorekeeper/:gameId — mobile stat-keeper (admin-only, bypass flag)
 *   3. /overlay-control/:gameId — admin console now carries a Highlights panel
 *   4. CheerMeter component mounts with its aria label
 *
 * Routes call the worker (mocked via page.route) — these tests do NOT need
 * a live Supabase instance. They validate the React/routing/rendering layer,
 * which is where the integration risk lives.
 */

import { expect, test } from '../playwright-fixture';

const GAME_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

// Realistic worker payload for /api/public/overlay/:gameId
const OVERLAY_PAYLOAD = {
  ok: true,
  game: {
    id: GAME_ID,
    status: 'live',
    category: 'league',
    home_score: 42,
    away_score: 39,
    leagues: { code: 'SBBL', name: 'Summer Basketball League' },
    home_team: { id: 'h', name: 'Vipers', logo_url: null },
    away_team: { id: 'a', name: 'Wolves', logo_url: null },
    participant1_label: null,
    participant2_label: null,
    event_name: null,
  },
  overlay: {
    game_id: GAME_ID,
    period: 2,
    period_label: 'Q2',
    clock_seconds: 300,
    clock_running: false,
    clock_last_started_at: null,
    home_score: 42,
    away_score: 39,
    home_fouls: 3,
    away_fouls: 2,
    home_timeouts_left: 4,
    away_timeouts_left: 4,
    possession: 'home',
    bonus_home: false,
    bonus_away: false,
    shot_clock_seconds: null,
    last_event_text: null,
    last_event_at: null,
    overlay_theme: 'default',
    show_sponsor_bug: true,
    show_lower_third: false,
    lower_third_text: null,
    lower_third_subtext: null,
    live_clock_seconds: 300,
  },
  sponsor: null,
  theme: 'default',
};

async function stubBroadcastApis(page: import('@playwright/test').Page) {
  // Mock /api/public-config so the bundle boots with a working Supabase client.
  // vite.config.ts no longer ships hardcoded prod fallbacks, so the chromeless
  // overlay shell still mounts AuthProvider and would otherwise see configAvailable=false.
  await page.route('**/api/public-config', (route) =>
    route.fulfill({
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
    }),
  );

  await page.route('**/api/public/overlay/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(OVERLAY_PAYLOAD),
    }),
  );
  await page.route('**/api/public/streams/*/reactions/aggregate*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: [
          { reaction_type: 'fire', count: 12 },
          { reaction_type: 'heart', count: 4 },
          { reaction_type: 'clap', count: 2 },
        ],
      }),
    }),
  );
  await page.route('**/api/public/highlights/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route('**/api/public/sponsors*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
}

test.describe('broadcast overlay flow', () => {
  test('/overlay/:gameId renders the chromeless scorebug with live payload', async ({
    page,
  }) => {
    await stubBroadcastApis(page);

    await page.goto(`/overlay/${GAME_ID}`, { waitUntil: 'domcontentloaded' });

    // Root container present (ChromelessShell mounts Overlay for this route)
    await expect(page.getByTestId('overlay-root')).toBeVisible({ timeout: 10_000 });

    // League chip
    await expect(page.getByTestId('overlay-root')).toContainText('SBBL');

    // Scores rendered with the stubbed values
    await expect(page.getByTestId('overlay-root')).toContainText('42');
    await expect(page.getByTestId('overlay-root')).toContainText('39');

    // Clock readable (Q2 at 5:00 remaining)
    await expect(page.getByTestId('overlay-root')).toContainText('Q2');
    await expect(page.getByTestId('overlay-root')).toContainText('5:00');

    // Cheer meter mounts as an aria-labelled region
    await expect(page.getByLabel('Live reactions')).toBeVisible();

    // Chromeless — the global header must NOT render on this route
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('/overlay/:gameId returns a useful message when payload missing', async ({
    page,
  }) => {
    await page.route('**/api/public/overlay/**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'game_not_found' }),
      }),
    );
    await page.route('**/api/public/streams/*/reactions/aggregate*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );

    await page.goto(`/overlay/${GAME_ID}`, { waitUntil: 'domcontentloaded' });

    // No crash, no header, some visible text so OBS doesn't get a black frame.
    await expect(page.locator('body')).toContainText(/Overlay unavailable|Missing/i, {
      timeout: 10_000,
    });
  });

  test('/scorekeeper/:gameId renders the mobile console with admin bypass', async ({
    page,
  }) => {
    await stubBroadcastApis(page);

    await page.goto(`/scorekeeper/${GAME_ID}`, { waitUntil: 'domcontentloaded' });

    // Header renders on non-chromeless routes.
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

    // Score numerals with stubbed values.
    await expect(page.locator('body')).toContainText('42');
    await expect(page.locator('body')).toContainText('39');

    // Large touch targets — the spec requires +1/+2/+3 per side.
    // (6 score buttons + away/home undo + clock controls.)
    await expect(page.getByRole('button', { name: /Away plus 2 points/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Home plus 3 points/i })).toBeVisible();

    // Clock value from the payload.
    await expect(page.locator('body')).toContainText('5:00');

    // Period indicator.
    await expect(page.locator('body')).toContainText('Q2');
  });

  test('/overlay-control/:gameId includes Highlights section', async ({
    page,
  }) => {
    await stubBroadcastApis(page);

    await page.goto(`/overlay-control/${GAME_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    // Core console header.
    await expect(page.getByRole('heading', { name: /Overlay Control/i })).toBeVisible(
      { timeout: 10_000 },
    );

    // New Highlights panel.
    await expect(page.getByRole('heading', { name: /Highlights/i })).toBeVisible();

    // Mark-highlight button from HighlightMarker component.
    await expect(page.getByRole('button', { name: /Mark Highlight/i })).toBeVisible();
  });
});
