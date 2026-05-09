import { test, expect } from '../playwright-fixture';

const STREAM_PATH = process.env.TEST_STREAM_PATH ?? '/live';
const REPLAY_PATH = process.env.TEST_REPLAY_PATH ?? '/replay';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

function requireTestCreds() {
  test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, 'TEST_USER_EMAIL and TEST_USER_PASSWORD are required');
}

async function login(page: import('@playwright/test').Page) {
  requireTestCreds();
  await page.goto('/login');
  await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_USER_EMAIL!);
  await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_USER_PASSWORD!);
  await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first().click();
  await page.waitForLoadState('networkidle');
}

async function mockLiveAccess(page: import('@playwright/test').Page, allowed: boolean) {
  await page.route('**/api/streams/**/session', async (route) => {
    if (!allowed) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'access_denied' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, playback: { type: 'url', url: '/__test__/sample.mp4' } }) });
  });
  await page.route('**/__test__/sample.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) }));
}

test.describe('Streaming access controls', () => {
  test('Test 1: stream gate blocks unauthenticated user', async ({ page }) => {
    await page.goto(STREAM_PATH);
    await expect(page).toHaveURL(/\/(purchase|login)/);
    await expect(page.locator('video')).toHaveCount(0);
  });

  test.skip('Test 2: PPV token grants stream access', 'Requires live WHEP stream — run manually pre-event', async ({ page }) => {
    await login(page);
    await mockLiveAccess(page, true);
    await page.goto(STREAM_PATH);
    await expect(page).toHaveURL(new RegExp(`${STREAM_PATH}$`));
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty('src', /.+/);
  });

  test('Test 3: Expired PPV token blocks access', async ({ page }) => {
    await login(page);
    await mockLiveAccess(page, false);
    await page.goto(STREAM_PATH);
    await expect(page.getByText(/access denied|purchase required|expired/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /purchase|buy|upgrade|subscribe/i })).toBeVisible();
  });

  test.skip('Test 4: Second device is blocked (one-device policy)', 'Requires live WHEP stream — run manually pre-event', async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const page1 = await first.newPage();
    const page2 = await second.newPage();

    await login(page1);
    await mockLiveAccess(page1, true);
    await page1.goto(STREAM_PATH);
    await expect(page1.locator('video').first()).toBeVisible();

    await login(page2);
    await page2.route('**/api/streams/**/session', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'already watching on another device' }) }));
    await page2.goto(STREAM_PATH);
    await expect(page2.getByText(/already watching on another device/i)).toBeVisible();

    await first.close();
    await second.close();
  });

  test('Test 5: Replay access requires same PPV token as live', async ({ browser }) => {
    const allowed = await browser.newContext();
    const blocked = await browser.newContext();
    const allowedPage = await allowed.newPage();
    const blockedPage = await blocked.newPage();

    await login(allowedPage);
    await mockLiveAccess(allowedPage, true);
    await allowedPage.goto(REPLAY_PATH);
    await expect(allowedPage.locator('video').first()).toBeVisible();

    await login(blockedPage);
    await mockLiveAccess(blockedPage, false);
    await blockedPage.goto(REPLAY_PATH);
    await expect(blockedPage.getByText(/access denied|purchase required|expired/i)).toBeVisible();

    await allowed.close();
    await blocked.close();
  });

  test.skip('Test 6: Stream page performance under load (basic smoke test)', 'Requires live WHEP stream — run manually pre-event', async ({ page }) => {
    await login(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const t0 = Date.now();
    await page.goto(STREAM_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(3000);
    expect(errors).toEqual([]);
  });
});
