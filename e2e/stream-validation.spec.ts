import { expect, seedSuperAdminSession, test } from "../playwright-fixture";

const GAME_ID = "stream-validation-game";
const SAMPLE_MP4 =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

async function registerEntitledStreamMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/public/home**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        liveGames: [
          {
            id: GAME_ID,
            status: "live",
            home_team_id: "h1",
            away_team_id: "a1",
            home_score: 44,
            away_score: 40,
            scheduled_at: new Date().toISOString(),
            venue: "Validation Arena",
            court: "Court A",
            league_code: "SBBL",
            home_team: { id: "h1", name: "Home" },
            away_team: { id: "a1", name: "Away" },
          },
        ],
        upcomingGames: [],
        recentGames: [],
      }),
    });
  });

  await page.route("**/ops/streams/config**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        config: {
          collectionId: SAMPLE_MP4,
          title: "Validation Stream",
          source: "main",
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
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        playback: {
          type: "url",
          url: SAMPLE_MP4,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          heartbeatIntervalSec: 25,
        },
        session: {
          id: "sess-validation-1",
          gameId: GAME_ID,
          maxExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/session/heartbeat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/session/end`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ended: true }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/comments**`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, comments: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comment: {
          id: "c1",
          message: "Validation comment",
          createdAt: new Date().toISOString(),
          userId: "u1",
          userDisplayName: "Validator",
        },
      }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/reactions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, fire: 0, heart: 0, clap: 0 }),
    });
  });

  await page.route(`**/api/streams/${GAME_ID}/react**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function collectMediaProof(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (!video) {
      return {
        signals: [] as string[],
        readyState: 0,
        width: 0,
        height: 0,
        currentStart: 0,
        currentEnd: 0,
      };
    }

    const start = video.currentTime;
    const playingEvent = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5_000);
      const onPlaying = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("playing", onPlaying);
        resolve(true);
      };
      video.addEventListener("playing", onPlaying, { once: true });
    });

    await new Promise((resolve) => setTimeout(resolve, 4_000));
    const end = video.currentTime;

    const signals: string[] = [];
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) signals.push("readyState");
    if (end > start + 0.5) signals.push("timeAdvance");
    if (playingEvent) signals.push("playingEvent");
    if (video.videoWidth > 0 && video.videoHeight > 0) signals.push("dimensions");
    if (video.error === null) signals.push("noError");

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

test.describe("stream prelive validation", () => {
  test("[evidence:playback] entitled playback emits media proof >= 4 signals", async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerEntitledStreamMocks(page);

    await page.goto("/live", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/Live Chat/i)).toBeVisible();
    await expect(page.getByText(/SESSION-BOUND/i)).toBeVisible();

    const proof = await collectMediaProof(page);
    expect(proof.signals.length).toBeGreaterThanOrEqual(4);
  });

  test("[evidence:paywall] unauthenticated viewer remains gated", async ({ page }) => {
    await page.route("**/api/public/home**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, liveGames: [], upcomingGames: [], recentGames: [] }),
      });
    });

    await page.goto("/live", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Register to Watch/i)).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
  });
});
