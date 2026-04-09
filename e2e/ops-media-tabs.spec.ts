import { expect, test } from '../playwright-fixture';

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
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ status: 200, body: '' });
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
  test('store and events tabs enforce super-admin guard in UI', async ({ page }) => {
    await registerOpsMediaRoutes(page);

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Store Media' }).click();
    await expect(page.getByText('Super Admin required to manually manage store operations.')).toBeVisible();

    await page.getByRole('tab', { name: 'Events' }).click();
    await expect(page.getByText('Super Admin required to manually manage events.')).toBeVisible();
  });

  test('potg upload submits ingest job and approve/reject use wrapped ops endpoints', async ({ page }) => {
    const captures = await registerOpsMediaRoutes(page);

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'POTG Parser' }).click();

    const potgInput = page.locator('div:has-text("Drop POTG graphic or click to upload") input[type="file"]');
    await potgInput.setInputFiles({ name: 'potg.png', mimeType: 'image/png', buffer: PNG_1X1 });

    await expect(page.getByText('Data extracted — review below')).toBeVisible();
    await page.getByRole('button', { name: 'Submit to Data Pipeline' }).click();

    await expect(page.getByText('needs_review')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('View on /media →')).toBeVisible();

    await page.getByRole('button', { name: 'Submit to Data Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('archived')).toBeVisible();

    const potgSubmit = captures.submitRequests.find((r) => r.kind === 'potg');
    expect(potgSubmit).toBeTruthy();
    expect(potgSubmit?.meta).toMatchObject({ playerName: 'Test Player', team: 'Test Team', pts: 22, rebs: 10, assts: 8 });

    expect(captures.approveRequests.some((r) => r.jobId === 'job-potg-001')).toBeTruthy();
    expect(captures.rejectRequests.some((r) => r.jobId === 'job-potg-001')).toBeTruthy();
    expect(captures.approveRequests.every((r) => Boolean(r.idempotency))).toBeTruthy();
    expect(captures.rejectRequests.every((r) => Boolean(r.idempotency))).toBeTruthy();
  });
});
