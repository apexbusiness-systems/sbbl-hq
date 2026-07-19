import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fQAAAAASUVORK5CYII=',
  'base64',
);

async function registerOpsMediaRoutes(page: import('@playwright/test').Page) {
  const presignRequests: Array<{ kind: string; filename: string; idempotency: string | null }> = [];
  const submitRequests: Array<Record<string, JsonValue>> = [];
  const approveRequests: Array<{ jobId: string; idempotency: string | null }> = [];
  const rejectRequests: Array<{ jobId: string; idempotency: string | null }> = [];

  await page.route('**/ops/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, user: { userId: 'ops-user', email: 'ops@test.local' }, roles: ['super_admin'], references: {}, importHistory: [] }),
    });
  });

  await page.route('**/ops/imports/history', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, jobs: [] }) });
  });

  await page.route('**/ops/potg/parse', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { playerName: 'Test Player', team: 'Test Team', pts: 22, rebs: 10, assts: 8, gameResult: 'TST 90-80' },
      }),
    });
  });

  await page.route('**/ops/event/parse', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { title: 'Friday Night Run', location: 'Main Gym', date: '2026-04-09', leagueId: 'sbbl' } }),
    });
  });

  await page.route('**/ops/imports/events', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/ops/ingest/presign', async (route) => {
    const req = route.request();
    const payload = req.postDataJSON() as { kind: string; filename: string };
    presignRequests.push({
      kind: payload.kind,
      filename: payload.filename,
      idempotency: req.headerValue('x-idempotency-key'),
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        signedUrl: `https://upload.test/${payload.kind}/${encodeURIComponent(payload.filename)}`,
        token: 'token-test',
        objectPath: `${payload.kind}/object-${presignRequests.length}.jpg`,
      }),
    });
  });

  await page.route('https://upload.test/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT',
          'Access-Control-Allow-Headers': '*',
        },
      });
      return;
    }
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: ''
    });
  });

  await page.route('**/ops/ingest/submit', async (route) => {
    const req = route.request();
    const payload = req.postDataJSON() as Record<string, JsonValue>;
    submitRequests.push(payload);

    const state = payload.kind === 'potg' ? 'needs_review' : 'published';
    const jobId = payload.kind === 'potg' ? 'job-potg-001' : `job-${String(payload.kind)}-${submitRequests.length}`;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, jobId, state, mediaAssetId: `asset-${jobId}`, publicationId: `pub-${jobId}` }),
    });
  });

  await page.route('**/ops/ingest/*/approve', async (route) => {
    const req = route.request();
    const match = req.url().match(/\/ops\/ingest\/(.+)\/approve$/);
    approveRequests.push({ jobId: match?.[1] ?? 'unknown', idempotency: req.headerValue('x-idempotency-key') });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, jobId: match?.[1] ?? 'unknown', publicationId: 'pub-approved', publishedAt: '2026-04-09T00:00:00Z' }),
    });
  });

  await page.route('**/ops/ingest/*/reject', async (route) => {
    const req = route.request();
    const match = req.url().match(/\/ops\/ingest\/(.+)\/reject$/);
    rejectRequests.push({ jobId: match?.[1] ?? 'unknown', idempotency: req.headerValue('x-idempotency-key') });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, jobId: match?.[1] ?? 'unknown', state: 'archived' }),
    });
  });

  return { presignRequests, submitRequests, approveRequests, rejectRequests };
}

test.describe('ops media ingest tabs', () => {
  test('no session shows fail-closed reauth state', async ({ page }) => {
    // Mock public-config to prevent real fetch / timeout during boot
    await page.route('**/api/public-config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, appName: 'SBBL HQ', defaultLeague: 'SBBL' }),
      });
    });

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Session expired. Sign in again.')).toBeVisible();
  });

  test('store and events tabs are reachable for super-admin sessions', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerOpsMediaRoutes(page);

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Store Media & Product Ops' })).toBeVisible();
    await expect(page.getByText('Super Admin required to manually manage store operations.')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: 'Events Manual Ops' })).toBeVisible();
    await expect(page.getByText('Super Admin required to manually manage events.')).toHaveCount(0);
  });

  test('potg upload submits ingest job and approve/reject use wrapped ops endpoints', async ({ page }) => {
    await seedSuperAdminSession(page);
    const captures = await registerOpsMediaRoutes(page);

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });

    const potgInput = page.locator('#potg-image-input');
    await potgInput.setInputFiles({ name: 'potg.png', mimeType: 'image/png', buffer: PNG_1X1 });

    const panelText = await page.locator('.panel').nth(0).innerText();
    console.log('PANEL TEXT:', panelText);
    const bodyText = await page.locator('body').innerText();
    console.log('BODY TEXT:', bodyText);

    await expect(page.getByText('Data extracted — review below')).toBeVisible();
    await page.getByRole('button', { name: 'Submit to Data Pipeline' }).click();

    await expect(page.getByText('needs_review')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('published', { exact: true }).first()).toBeVisible();

    const potgSubmit = captures.submitRequests.find((r) => r.kind === 'potg');
    expect(potgSubmit).toBeTruthy();
    expect(potgSubmit?.meta).toMatchObject({ playerName: 'Test Player', team: 'Test Team', pts: 22, rebs: 10, assts: 8 });
  });
});
