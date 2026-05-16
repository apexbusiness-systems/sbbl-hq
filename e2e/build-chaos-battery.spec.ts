import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

type ChaosState = {
  counters: Map<string, number>;
};

function bump(state: ChaosState, key: string): number {
  const next = (state.counters.get(key) ?? 0) + 1;
  state.counters.set(key, next);
  return next;
}

async function registerBuildChaosRoutes(page: import('@playwright/test').Page) {
  const state: ChaosState = { counters: new Map() };

  await page.route('**/ops/bootstrap', async (route) => {
    const call = bump(state, 'ops/bootstrap');
    if (call === 1) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'unauthorized' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        user: { userId: 'ops-chaos', email: 'ops-chaos@test.local' },
        roles: ['super_admin'],
        references: {},
        importHistory: [],
      }),
    });
  });

  await page.route('**/ops/imports/history', async (route) => {
    bump(state, 'ops/imports/history');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, jobs: [] }) });
  });

  await page.route('**/api/public/home**', async (route) => {
    const call = bump(state, 'api/public/home');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_home_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        liveGames: [],
        upcomingGames: [],
        recentGames: [],
      }),
    });
  });

  // Admin stream config polling path (when current auth role resolves to super_admin).
  await page.route('**/ops/streams/config**', async (route) => {
    const call = bump(state, 'ops/streams/config');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_stream_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        config: {
          collectionId: '',
          title: 'Chaos-safe offline state',
          source: 'main',
          isLive: false,
          viewerCount: 0,
        },
      }),
    });
  });

  // Public stream status polling path (when current auth role is not super_admin).
  await page.route('**/api/streams/status**', async (route) => {
    const call = bump(state, 'api/streams/status');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_stream_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        isLive: false,
        title: 'Chaos-safe offline state',
        viewerCount: 0,
        collectionId: '',
      }),
    });
  });

  // Use regex instead of glob so the pattern only matches the API endpoint and
  // not the Vite-served source module src/lib/api/scores.ts (which also contains
  // the literal path segment /api/scores and would receive application/json,
  // causing Chrome's strict MIME-type check to abort the dynamic import).
  await page.route(/\/api\/scores(\?|$)/, async (route) => {
    const call = bump(state, 'api/scores');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_scores_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        games: [
          {
            id: 'score-chaos-1',
            category: 'league',
            leagueId: 'sbbl',
            homeLabel: 'Chaos Home',
            awayLabel: 'Chaos Away',
            homeScore: 91,
            awayScore: 88,
            status: 'final',
            gameDate: '2026-04-09',
          },
        ],
      }),
    });
  });

  // Same fix: src/lib/api/teams.ts contains /api/teams in its path.
  await page.route(/\/api\/teams(\?|$)/, async (route) => {
    const call = bump(state, 'api/teams');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_teams_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        teams: [
          {
            id: 'team-chaos-1',
            name: 'Chaos Unit',
            league_code: 'SBBL',
            league_name: 'SBBL',
            season_name: 'Season 11',
            division_name: 'A',
            roster_count: 5,
            players: [],
            coaches: [],
            stats: {
              wins: 5,
              losses: 2,
              gamesPlayed: 7,
              ptsFor: 650,
              ptsAgainst: 600,
              winPct: '0.714',
              diff: 50,
            },
          },
        ],
      }),
    });
  });

  await page.route('**/api/public/schedule**', async (route) => {
    const call = bump(state, 'api/public/schedule');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_schedule_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route('**/api/public/media**', async (route) => {
    const call = bump(state, 'api/public/media');
    if (call === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'chaos_media_turbulence' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: 'media-chaos-1',
            title: 'Chaos Battery Verified',
            type: 'highlight',
            thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fQAAAAASUVORK5CYII=',
            leagueId: 'sbbl',
            status: 'published',
            date: '2026-04-09',
          },
        ],
      }),
    });
  });

  return state;
}

async function attachRouteDiagnostics(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo,
  stepPath: string,
) {
  const tag = stepPath.replaceAll('/', '_');
  await testInfo.attach(`route-${tag}-url`, { body: page.url(), contentType: 'text/plain' });
  await testInfo.attach(`route-${tag}-headings`, {
    body: JSON.stringify(
      await page.locator('h1,h2,[role="heading"]').allTextContents(),
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await testInfo.attach(`route-${tag}-body`, {
    body: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000),
    contentType: 'text/plain',
  });
  await testInfo.attach(`route-${tag}-screenshot`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

async function visitAndVerify(
  page: import('@playwright/test').Page,
  step: { path: string; verify: () => Promise<void> },
  testInfo: import('@playwright/test').TestInfo,
) {
  await page.goto(step.path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${step.path}(?:[?#]|$)`));
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  try {
    await step.verify();
  } catch (error) {
    await attachRouteDiagnostics(page, testInfo, step.path);
    throw error;
  }
}

test.describe('full-build chaos battery', () => {
  test('cross-route orchestration survives auth/network turbulence', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await seedSuperAdminSession(page);
    const state = await registerBuildChaosRoutes(page);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const routeChecks: Array<{ path: string; verify: () => Promise<void> }> = [
      {
        path: '/league/sbbl',
        verify: async () => {
          await expect(page.locator('header')).toBeVisible();
          await expect(page.getByRole('link', { name: 'Live', exact: true })).toBeVisible();
          await expect.poll(() => state.counters.get('api/public/home') ?? 0).toBeGreaterThan(0);
        },
      },
      {
        path: '/live',
        verify: async () => {
          await expect(page.getByText('Live Chat')).toBeVisible();
          await expect
            .poll(
              () =>
                (state.counters.get('ops/streams/config') ?? 0) +
                (state.counters.get('api/streams/status') ?? 0),
            )
            .toBeGreaterThan(0);
        },
      },
      {
        path: '/scores',
        verify: async () => {
          await expect(page.getByRole('heading', { name: 'Scores' })).toBeVisible();
          await expect.poll(() => state.counters.get('api/scores') ?? 0).toBeGreaterThan(0);
        },
      },
      {
        path: '/teams',
        verify: async () => {
          await expect(page.getByRole('heading', { name: 'Teams & Standings' })).toBeVisible();
          await expect.poll(() => state.counters.get('api/teams') ?? 0).toBeGreaterThan(0);
        },
      },
      {
        path: '/schedules',
        verify: async () => {
          await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
          await expect.poll(() => state.counters.get('api/public/schedule') ?? 0).toBeGreaterThan(0);
        },
      },
      {
        path: '/media',
        verify: async () => {
          await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
          await expect.poll(() => state.counters.get('api/public/media') ?? 0).toBeGreaterThan(0);
        },
      },
      {
        path: '/ops',
        verify: async () => {
          await expect(page.getByRole('tab', { name: 'POTG Parser' })).toBeVisible();
          await expect(page.getByText('Session expired. Sign in again.')).toHaveCount(0);
          await expect.poll(() => state.counters.get('ops/bootstrap') ?? 0).toBeGreaterThan(0);
        },
      },
    ];

    for (let round = 0; round < 3; round += 1) {
      for (const step of routeChecks) {
        await visitAndVerify(page, step, testInfo);
      }
    }

    expect(pageErrors).toEqual([]);

    expect((state.counters.get('ops/bootstrap') ?? 0) >= 1).toBeTruthy();
    expect((state.counters.get('api/public/home') ?? 0) >= 1).toBeTruthy();

    const streamPollCalls =
      (state.counters.get('ops/streams/config') ?? 0) +
      (state.counters.get('api/streams/status') ?? 0);
    expect(streamPollCalls >= 1).toBeTruthy();

    expect((state.counters.get('api/scores') ?? 0) >= 1).toBeTruthy();
    expect((state.counters.get('api/teams') ?? 0) >= 1).toBeTruthy();
    expect((state.counters.get('api/public/schedule') ?? 0) >= 1).toBeTruthy();
    expect((state.counters.get('api/public/media') ?? 0) >= 1).toBeTruthy();
  });
});
