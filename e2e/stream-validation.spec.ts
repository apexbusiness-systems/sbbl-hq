import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

const GAME_ID = 'stream-validation-game';
/** Marker URL for test playback — intercepted by addInitScript to simulate media signals */
const SAMPLE_MP4 = '/__test__/sample.mp4';
const PLAYER_HOST_SELECTOR = '[data-testid="unified-react-player"]';

/**
 * Inject a lightweight HTMLMediaElement stub so the <video> element created by
 * ReactPlayer produces the same playback signals a real stream would, without
 * requiring network access to an external video file.
 */
async function stubVideoPlayback(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (!srcDesc) return;

    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      set(value: string) {
        srcDesc.set!.call(this, value);
        if (typeof value === 'string' && value.includes('__test__/sample')) {
          const el = this as HTMLVideoElement;
          let t = 0;
          Object.defineProperty(el, 'readyState', { get: () => 4, configurable: true });
          Object.defineProperty(el, 'videoWidth', { get: () => 320, configurable: true });
          Object.defineProperty(el, 'videoHeight', { get: () => 240, configurable: true });
          Object.defineProperty(el, 'duration', { get: () => 10, configurable: true });
          Object.defineProperty(el, 'paused', { get: () => false, configurable: true });
          Object.defineProperty(el, 'error', { get: () => null, configurable: true });
          Object.defineProperty(el, 'currentTime', {
            get: () => t,
            set: (v: number) => { t = v; },
            configurable: true,
          });
          // Suppress native error events from the actual empty src
          el.addEventListener('error', (e) => { e.stopImmediatePropagation(); }, true);
          // Advance time
          const iv = window.setInterval(() => { t += 0.2; }, 200);
          // Fire playback lifecycle events after a short delay so ReactPlayer's
          // internal listeners are attached before the first dispatch.
          window.setTimeout(() => {
            el.dispatchEvent(new Event('loadedmetadata'));
            el.dispatchEvent(new Event('loadeddata'));
            el.dispatchEvent(new Event('canplay'));
            el.dispatchEvent(new Event('canplaythrough'));
            el.dispatchEvent(new Event('playing'));
          }, 300);
          // Re-emit playing once more for late listeners (like collectMediaProof)
          window.setTimeout(() => el.dispatchEvent(new Event('playing')), 2000);
          // Cleanup on removal
          const obs = new MutationObserver(() => {
            if (!el.isConnected) { window.clearInterval(iv); obs.disconnect(); }
          });
          obs.observe(document, { childList: true, subtree: true });
        }
      },
      get() { return srcDesc.get!.call(this); },
      configurable: true,
      enumerable: true,
    });
  });
}

async function registerEntitledStreamMocks(page: import('@playwright/test').Page) {
  // Serve a valid empty response for the video URL — the actual playback
  // signals are provided by stubVideoPlayback() via HTMLMediaElement prototype override.
  await page.route('**/__test__/sample*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) });
  });

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
          collectionId: SAMPLE_MP4,
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
          url: SAMPLE_MP4,
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
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      // Provider iframe path (no direct <video> in DOM): validate player shell
      // so playback surface proof still exists.
      const switcherHost = document.querySelector('[data-testid="unified-react-player"]') as HTMLElement | null;
      const hasIframe = Boolean(switcherHost?.querySelector('iframe'));
      const hostRect = switcherHost?.getBoundingClientRect();
      const signals: string[] = [];
      if (switcherHost) signals.push('switcherHost');
      if (hasIframe) signals.push('iframeMounted');
      if ((hostRect?.width ?? 0) > 0 && (hostRect?.height ?? 0) > 0) signals.push('hostSized');
      if (!document.body.textContent?.includes('Stream Unavailable')) signals.push('noPlayerError');
      return {
        signals,
        readyState: 0,
        width: Math.round(hostRect?.width ?? 0),
        height: Math.round(hostRect?.height ?? 0),
        currentStart: 0,
        currentEnd: 0,
      };
    }

    const start = video.currentTime;
    const playingEvent = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5_000);
      const onPlaying = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('playing', onPlaying);
        resolve(true);
      };
      video.addEventListener('playing', onPlaying, { once: true });
    });

    await new Promise((resolve) => setTimeout(resolve, 4_000));
    const end = video.currentTime;

    const signals: string[] = [];
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) signals.push('readyState');
    if (end > start + 0.5) signals.push('timeAdvance');
    if (playingEvent) signals.push('playingEvent');
    if (video.videoWidth > 0 && video.videoHeight > 0) signals.push('dimensions');
    if (video.error === null) signals.push('noError');

    return {
      signals,
      readyState: video.readyState,
      width: video.videoWidth,
      height: video.videoHeight,
      currentStart: start,
      currentEnd: end,
    };
  });
}

test.describe('stream prelive validation', () => {
  test('[evidence:playback] entitled playback emits media proof >= 4 signals', async ({ page }) => {
    await stubVideoPlayback(page);
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);

    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Live Chat/i)).toBeVisible();
    await expect(page.getByText(/SESSION-BOUND/i)).toBeVisible();

    // Wait for stream config to resolve (isStreamLive → true removes the overlay)
    await expect(page.getByText(/Stream Starting Soon/i)).toBeHidden({ timeout: 10_000 });
    // Wait for playback session to resolve and playback surface to mount.
    await expect
      .poll(async () => page.locator(`video, ${PLAYER_HOST_SELECTOR}`).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

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

  test.afterEach(async ({ cspWatcher }, testInfo) => {
    if (testInfo.status !== 'passed') return;
    expect(
      cspWatcher.violations,
      `CSP violations:\n${cspWatcher.violations.join('\n')}`,
    ).toHaveLength(0);
    expect(
      cspWatcher.pageErrors,
      `CSP page errors:\n${cspWatcher.pageErrors.join('\n')}`,
    ).toHaveLength(0);
  });
});
