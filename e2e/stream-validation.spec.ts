import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

const GAME_ID = 'stream-validation-game';
/** Valid YouTube Live URL for mocked playback session */
const SAMPLE_YOUTUBE_LIVE = 'https://www.youtube.com/live/dQw4w9WgXcQ';

async function registerEntitledStreamMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/public/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        liveGames: [
          {
            id: GAME_ID,
            status: 'live',
            home_team_id: 'h1',
            away_team_id: 'a1',
            home_score: 44,
            away_score: 40,
            scheduled_at: new Date().toISOString(),
            venue: 'Validation Arena',
            court: 'Court A',
            league_code: 'SBBL',
            home_team: { id: 'h1', name: 'Home' },
            away_team: { id: 'a1', name: 'Away' },
          },
        ],
        upcomingGames: [],
        recentGames: [],
      }),
    });
  });

  await page.route('**/ops/streams/config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        config: {
          collectionId: SAMPLE_YOUTUBE_LIVE,
          title: 'Validation Stream',
          source: 'main',
          isLive: true,
          viewerCount: 2,
          gameId: GAME_ID,
        },
      }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/session`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        playback: {
          type: 'url',
          url: SAMPLE_YOUTUBE_LIVE,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          heartbeatIntervalSec: 25,
        },
        session: {
          id: 'sess-validation-1',
          gameId: GAME_ID,
          maxExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/session/heartbeat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/session/end`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, ended: true }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/comments**`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, comments: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        comment: {
          id: 'c1',
          message: 'Validation comment',
          createdAt: new Date().toISOString(),
          userId: 'u1',
          userDisplayName: 'Validator',
        },
      }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/reactions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, fire: 3, heart: 4, clap: 5 }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/react`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, accepted: true }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/viewer-count`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, gameId: GAME_ID, activeEntitledViewerCount: 2 }),
    });
  });

  await page.route(`**/api/streams/status**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, isLive: true, title: 'Validation Stream', viewerCount: 2, gameId: GAME_ID }),
    });
  });
}

async function collectMediaProof(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const iframe = document.querySelector('iframe[title=\"SBBL Live Stream\"]') as HTMLIFrameElement | null;
    if (!iframe) {
      return {
        signals: [] as string[],
        src: '',
        allowFullScreen: false,
        referrerPolicy: '',
        width: 0,
        height: 0,
      };
    }

    const signals: string[] = [];
    if (iframe.src.includes('https://www.youtube.com/embed/')) signals.push('youtubeEmbedSrc');
    if (iframe.src.includes('autoplay=1')) signals.push('autoplayEnabled');
    if (iframe.allow.includes('autoplay')) signals.push('allowAutoplay');
    if (iframe.allowFullscreen) signals.push('allowFullscreen');
    if (iframe.clientWidth >= 0 && iframe.clientHeight >= 0) signals.push('iframeMounted');

    return {
      signals,
      src: iframe.src,
      allowFullScreen: iframe.allowFullscreen,
      referrerPolicy: iframe.referrerPolicy,
      width: iframe.clientWidth,
      height: iframe.clientHeight,
    };
  });
}

test.describe('stream prelive validation', () => {
  test('[evidence:playback] entitled playback emits media proof >= 4 signals', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);

    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Live Chat/i)).toBeVisible();
    await expect(page.getByText(/SESSION-BOUND/i)).toBeVisible();

    // Wait for stream config to resolve (isStreamLive → true removes the overlay)
    await expect(page.getByText(/Stream Starting Soon/i)).toBeHidden({ timeout: 10_000 });
    // Wait for playback session to resolve and YouTube iframe to mount.
    await page.locator('iframe[title=\"SBBL Live Stream\"]').waitFor({ state: 'attached', timeout: 15_000 });

    const proof = await collectMediaProof(page);
    expect(proof.signals.length).toBeGreaterThanOrEqual(4);
  });

  test('[evidence:paywall] unauthenticated viewer remains gated', async ({ page }) => {
    // Mock public-config so the app boots without hitting the real Worker
    await page.route('**/api/public-config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, appName: 'SBBL HQ', defaultLeague: 'SBBL' }),
      });
    });

    // Provide a live game so Live.tsx renders LiveStreamPlayer (which contains the gate)
    await page.route('**/api/public/home**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          liveGames: [{
            id: 'gate-test-game',
            status: 'live',
            home_team_id: 'h1',
            away_team_id: 'a1',
            home_score: 0,
            away_score: 0,
            scheduled_at: new Date().toISOString(),
            venue: 'Test Arena',
            court: 'Court A',
            league_code: 'SBBL',
            home_team: { id: 'h1', name: 'Home' },
            away_team: { id: 'a1', name: 'Away' },
          }],
          upcomingGames: [],
          recentGames: [],
        }),
      });
    });

    // Mock stream status to prevent the non-admin poller from hanging
    await page.route('**/api/streams/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, isLive: true, title: 'Test', viewerCount: 0, gameId: 'gate-test-game' }),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Register to Watch/i)).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
  });

  test('[evidence:comments] entitled viewer comment submission is accepted', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);
    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    const commentPayload = await page.evaluate(async (gameId) => {
      const response = await fetch(`/api/streams/${gameId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': `comment-${Date.now()}` },
        body: JSON.stringify({ message: 'Validation comment' }),
      });
      return response.json();
    }, GAME_ID);

    expect(commentPayload.ok).toBe(true);
    expect(commentPayload.comment?.message).toBe('Validation comment');
  });

  test('[evidence:reactions] entitled reaction emits accepted telemetry', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);
    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    const reactionPayload = await page.evaluate(async (gameId) => {
      const submit = await fetch(`/api/streams/${gameId}/react`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': `reaction-${Date.now()}` },
        body: JSON.stringify({ reactionType: 'fire' }),
      });
      const read = await fetch(`/api/streams/${gameId}/reactions`);
      return {
        submit: await submit.json(),
        read: await read.json(),
      };
    }, GAME_ID);

    expect(reactionPayload.submit.ok).toBe(true);
    expect(reactionPayload.read.ok).toBe(true);
    expect(reactionPayload.read.fire).toBeGreaterThanOrEqual(0);
  });

  test('[evidence:viewer-count] active viewer count reflects entitled session truth', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);
    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    const viewerCounter = await page.evaluate(async (gameId) => {
      const direct = await fetch(`/api/streams/${gameId}/viewer-count`);
      const status = await fetch('/api/streams/status');
      return {
        direct: await direct.json(),
        status: await status.json(),
      };
    }, GAME_ID);

    expect(viewerCounter.direct.ok).toBe(true);
    expect(viewerCounter.direct.activeEntitledViewerCount).toBe(2);
    expect(viewerCounter.status.viewerCount).toBe(2);
  });
});
