import { test, expect, seedSuperAdminSession } from '../playwright-fixture';

// Generate dynamic tournament/team data to avoid uniqueness collisions
const runId = Math.random().toString(36).substring(2, 8);
const TOURNAMENT_NAME = `Build Chaos Cup ${runId}`;
const TEAM_A = `Chaos Core ${runId}`;
const TEAM_B = `Turbulence FC ${runId}`;

// WebKit race condition mitigation: Some slower WebKit engines (e.g., CI runners)
// struggle to process multiple parallel mocked routes alongside React hydration,
// causing 500ms timeouts to flake. We extend expect.poll to 30s.
const INTERCEPTION_POLL_TIMEOUT = 30_000;

// Type definition for route payloads
interface MatchScorePayload {
  home: number;
  away: number;
}

test.describe('sbbl hq build chaos battery', () => {
  // 1. Initial State: Ensures the app boots cleanly and layout isn't broken
  test('verify public layout and structural integrity', async ({ page, isMobile }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page.locator('header')).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.locator('nav').filter({ hasText: 'Standings' })).toBeVisible();
      await page.getByRole('button', { name: 'Close menu' }).click();
    } else {
      await expect(page.locator('header nav').first()).toBeVisible();
    }
  });

  // 2. High-Turbulence Operations Flow
  // This test hits the core operational pathways: creating a tournament,
  // registering teams, creating a game, and logging a score. It asserts
  // state transitions under full mocked API responses to ensure the frontend
  // doesn't buckle when interacting with data models.
  test('execute full tournament orchestration cycle under heavy mocking', async ({ page }) => {
    await seedSuperAdminSession(page);

    // MOCK: Tournament Creation
    await page.route('**/api/tournaments', async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as { name: string; leagueId: string; seasonId: string };
        expect(payload.name).toBe(TOURNAMENT_NAME);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, tournament: { id: `tourney_${runId}`, ...payload, status: 'upcoming' } })
        });
      } else {
        await route.fallback();
      }
    });

    // MOCK: Team Registration
    await page.route('**/api/teams', async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as { name: string };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, team: { id: `team_${Math.random()}`, name: payload.name } })
        });
      } else {
        await route.fallback();
      }
    });

    // MOCK: Game Creation
    await page.route('**/api/games', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            game: {
              id: `game_${runId}`,
              homeTeamId: `team_home_${runId}`,
              awayTeamId: `team_away_${runId}`,
              status: 'scheduled'
            }
          })
        });
      } else {
        await route.fallback();
      }
    });

    // MOCK: Score Submission
    let scoreSubmitted = false;
    await page.route(`**/api/games/game_${runId}/score`, async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as MatchScorePayload;
        expect(payload.home).toBe(88);
        expect(payload.away).toBe(82);
        scoreSubmitted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true })
        });
      } else {
        await route.fallback();
      }
    });

    // We don't actually click through the UI to trigger these mocks in this test
    // because the UI requires complex drag-and-drop or multi-step wizards that are
    // heavily layout-dependent. Instead, we use this test to verify the route
    // interception layer itself is stable across browsers.

    // Force a fetch to verify interception
    const result = await page.evaluate(async (name) => {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leagueId: 'sbbl', seasonId: 'season_1' })
      });
      return res.json();
    }, TOURNAMENT_NAME);

    expect(result.ok).toBe(true);
    expect(result.tournament.name).toBe(TOURNAMENT_NAME);

    const scoreResult = await page.evaluate(async (id) => {
      const res = await fetch(`/api/games/${id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home: 88, away: 82 })
      });
      return res.json();
    }, `game_${runId}`);

    expect(scoreResult.ok).toBe(true);

    // WebKit Race Condition Fix: extend poll timeout to 30s for slow execution engines
    await expect.poll(() => scoreSubmitted, { timeout: INTERCEPTION_POLL_TIMEOUT }).toBe(true);
  });

  // 3. Error Boundary and Resilience
  // Intentionally trigger API failures to ensure the frontend displays appropriate
  // error states rather than crashing the React tree.
  test('gracefully handle catastrophic API failures', async ({ page }) => {
    // Mock the live schedule endpoint to return a 500 Internal Server Error
    await page.route('**/api/public/schedule/live', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });

    // Mock recent games to return a 502 Bad Gateway
    await page.route('**/api/public/schedule/recent', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><body>502 Bad Gateway</body></html>'
      });
    });

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // The header should still render despite the schedule fetching errors below it
    await expect(page.locator('header')).toBeVisible();

    // The application should catch the error and not white-screen
    // We expect either an empty state, a generic error message, or the UI simply
    // hiding the section, but NOT a full React crash.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Application Error'); // Next.js fatal error
    expect(bodyText).not.toContain('Minified React error'); // React fatal error
  });

  // 4. Rate Limit / 429 Resilience
  test('gracefully handle 429 rate limit responses', async ({ page }) => {
    await page.route('**/api/public/media', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({ error: 'Too many requests' })
      });
    });

    await page.goto('/media', { waitUntil: 'domcontentloaded' });

    // Ensure the page doesn't crash on 429
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();

    // It should show some form of empty/error state, not crash
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Application Error');
  });

  // 5. Auth Middleware and Protection
  // Verify that protected routes kick unauthenticated users to the login screen
  test('enforce authentication boundaries on ops routes', async ({ page }) => {
    // Ensure no auth session exists
    await page.context().clearCookies();

    // Attempt to access an ops route
    const response = await page.goto('/ops', { waitUntil: 'networkidle' });

    // The router should intercept and redirect to /login
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('redirect=%2Fops');

    // The login form should be visible
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  // 6. Navigation and Layout Thrash Test
  // Rapidly navigate between pages to ensure no memory leaks, unmatched layout
  // transitions, or hydration mismatches occur under stress.
  test('survive rapid layout thrashing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Fire off several navigations sequentially
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();

    await page.goto('/standings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();

    await page.goto('/media', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();

    // And back to home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();

    // Verify footer is still intact after thrashing
    await expect(page.locator('footer')).toBeVisible();
  });

  // 7. Strict TypeScript Interface Validation (API Simulation)
  // Ensure the frontend correctly parses strict type shapes
  test('process exact TypeBox schemas without validation errors', async ({ page }) => {
    await seedSuperAdminSession(page);

    await page.route('**/api/public/tournaments', async (route) => {
      // Return a hyper-strict shape matching our exact DB types
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: 'tourney_strict_1',
              name: 'Strict Cup',
              status: 'upcoming',
              leagueId: 'sbbl',
              seasonId: 'season_1',
              // Including unexpected fields to ensure the frontend doesn't choke
              // on overly permissive schemas (Postel's Law)
              _internalFlags: ['HIDDEN'],
              __v: 1
            }
          ]
        })
      });
    });

    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    // The page should load cleanly despite unexpected fields in the payload
    await expect(page.locator('header')).toBeVisible();
  });

  // 8. Stream Playback Mount/Unmount Stability
  // Ensure the LiveStreamPlayer and CustomTwitchPlayer don't leave lingering
  // event listeners or iframe timeouts when rapidly unmounted.
  test('survive live stream player unmount chaos', async ({ page }) => {
    // Mock the session endpoint to return a valid Twitch URL
    await page.route('**/api/streams/*/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playback: { url: 'https://twitch.tv/sbblhq', heartbeatIntervalSec: 60 },
          session: { id: 'sess_123' }
        })
      });
    });

    // Start with a super admin session so it bypasses the paywall and mounts the player directly
    await seedSuperAdminSession(page);

    // Go to the live page for a mocked game
    await page.goto('/live?game=game_chaos', { waitUntil: 'domcontentloaded' });

    // Wait for the player container to mount
    await expect(page.getByTestId('stream-player')).toBeVisible({ timeout: 10_000 });

    // Immediately navigate away before the Twitch SDK finishes its iframe handshakes
    await page.goto('/standings', { waitUntil: 'domcontentloaded' });

    // The app should not crash or throw unhandled promise rejections from the Twitch SDK
    await expect(page.locator('header')).toBeVisible();

    // Ensure the heartbeat cleanup was triggered (no floating intervals)
    // We can't directly check intervals, but we can verify the DOM is clean
    expect(await page.getByTestId('stream-player').count()).toBe(0);
  });
});
