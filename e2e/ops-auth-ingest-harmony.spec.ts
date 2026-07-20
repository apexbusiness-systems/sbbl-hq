import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type MediaAsset = {
  id: string;
  title: string;
  type: 'highlight' | 'clip' | 'poster' | 'photo';
  thumbnail: string;
  leagueId: 'sbbl' | 'wbl' | 'tgifbl';
  status: 'draft' | 'ready' | 'published';
  date: string;
};

type UploadDimensions = {
  width: number;
  height: number;
};

type RegisterOptions = {
  bootstrap401Once?: boolean;
};

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fQAAAAASUVORK5CYII=';
const PNG_1X1 = Buffer.from(PNG_1X1_BASE64, 'base64');
const THUMBNAIL_DATA_URL = `data:image/png;base64,${PNG_1X1_BASE64}`;

function parseJpegDimensions(bytes: Buffer): UploadDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }

    const segmentSize = bytes.readUInt16BE(offset + 2);
    if (segmentSize < 2 || offset + 2 + segmentSize > bytes.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height };
    }

    offset += 2 + segmentSize;
  }

  return null;
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, JsonValue>;
}

function toLeagueId(raw: unknown): 'sbbl' | 'wbl' | 'tgifbl' {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (value === 'wbl' || value === 'tgifbl') return value;
  return 'sbbl';
}

function toMediaType(kind: string): MediaAsset['type'] {
  if (kind === 'potg') return 'highlight';
  if (kind === 'event') return 'poster';
  return 'photo';
}

function buildMediaAsset(jobId: string, payload: Record<string, JsonValue>): MediaAsset {
  const kind = typeof payload.kind === 'string' ? payload.kind : 'generic';
  const meta = asRecord(payload.meta as JsonValue | undefined);
  const date = typeof meta.date === 'string' && meta.date.trim().length > 0
    ? meta.date
    : '2026-04-09';

  return {
    id: `media-${jobId}`,
    title: typeof payload.title === 'string' ? payload.title : `Media ${jobId}`,
    type: toMediaType(kind),
    thumbnail: THUMBNAIL_DATA_URL,
    leagueId: toLeagueId(payload.leagueId),
    status: 'published',
    date,
  };
}

async function registerHarmonyRoutes(page: import('@playwright/test').Page, options: RegisterOptions = {}) {
  const presignRequests: Array<{ kind: string; filename: string; idempotency: string | null }> = [];
  const submitRequests: Array<Record<string, JsonValue>> = [];
  const approveRequests: Array<{ jobId: string; idempotency: string | null }> = [];
  const rejectRequests: Array<{ jobId: string; idempotency: string | null }> = [];
  const mediaFeed: MediaAsset[] = [];
  const potgUploadDimensions: UploadDimensions[] = [];
  const submitPayloadByJobId = new Map<string, Record<string, JsonValue>>();

  let bootstrapCalls = 0;

  const upsertMediaFromSubmit = (jobId: string) => {
    const payload = submitPayloadByJobId.get(jobId);
    if (!payload) return;
    const next = buildMediaAsset(jobId, payload);
    const existing = mediaFeed.findIndex((item) => item.id === next.id);
    if (existing >= 0) {
      mediaFeed.splice(existing, 1, next);
      return;
    }
    mediaFeed.unshift(next);
  };

  await page.route('**/ops/bootstrap', async (route) => {
    bootstrapCalls += 1;
    if (options.bootstrap401Once && bootstrapCalls === 1) {
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
        user: { userId: 'ops-user', email: 'ops@test.local' },
        roles: ['super_admin'],
        references: {},
        importHistory: [],
      }),
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
        data: {
          playerName: 'Test Player',
          team: 'Test Team',
          pts: 22,
          rebs: 10,
          assts: 8,
          gameResult: 'TST 90-80',
        },
      }),
    });
  });

  await page.route('**/ops/event/parse', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { title: 'Friday Night Run', location: 'Main Gym', date: '2026-04-09', leagueId: 'sbbl' },
      }),
    });
  });

  await page.route('**/ops/imports/events', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/ops/ingest/presign', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { kind: string; filename: string };
    presignRequests.push({
      kind: payload.kind,
      filename: payload.filename,
      idempotency: request.headerValue('x-idempotency-key'),
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

    const uploadBody = route.request().postDataBuffer();
    if (uploadBody) {
      const dimensions = parseJpegDimensions(uploadBody);
      if (dimensions) potgUploadDimensions.push(dimensions);
    }

    await route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    });
  });

  await page.route('**/ops/ingest/submit', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as Record<string, JsonValue>;
    submitRequests.push(payload);

    const kind = typeof payload.kind === 'string' ? payload.kind : 'generic';
    const state = kind === 'potg' ? 'needs_review' : 'published';
    const jobId = kind === 'potg' ? 'job-potg-001' : `job-${kind}-${submitRequests.length}`;

    submitPayloadByJobId.set(jobId, payload);
    if (state === 'published') {
      upsertMediaFromSubmit(jobId);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        jobId,
        state,
        mediaAssetId: `asset-${jobId}`,
        publicationId: `pub-${jobId}`,
      }),
    });
  });

  await page.route('**/ops/ingest/*/approve', async (route) => {
    const request = route.request();
    const match = request.url().match(/\/ops\/ingest\/(.+)\/approve$/);
    const jobId = match?.[1] ?? 'unknown';
    approveRequests.push({
      jobId,
      idempotency: request.headerValue('x-idempotency-key'),
    });

    upsertMediaFromSubmit(jobId);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        jobId,
        publicationId: `pub-${jobId}`,
        publishedAt: '2026-04-09T00:00:00Z',
      }),
    });
  });

  await page.route('**/ops/ingest/*/reject', async (route) => {
    const request = route.request();
    const match = request.url().match(/\/ops\/ingest\/(.+)\/reject$/);
    const jobId = match?.[1] ?? 'unknown';
    rejectRequests.push({
      jobId,
      idempotency: request.headerValue('x-idempotency-key'),
    });

    const mediaId = `media-${jobId}`;
    const index = mediaFeed.findIndex((item) => item.id === mediaId);
    if (index >= 0) mediaFeed.splice(index, 1);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, jobId, state: 'archived' }),
    });
  });

  await page.route('**/api/public/media', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: mediaFeed }),
    });
  });

  return { presignRequests, submitRequests, approveRequests, rejectRequests, mediaFeed, potgUploadDimensions };
}

test.describe('ops auth + ingest harmony gate', () => {
  test('recovers from initial /ops/bootstrap 401 and keeps ops usable', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerHarmonyRoutes(page, { bootstrap401Once: true });

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Session expired. Sign in again.')).toHaveCount(0);
  });

  test('potg ingest approves into /media and core routes still render', async ({ page }) => {
    await seedSuperAdminSession(page);
    const captures = await registerHarmonyRoutes(page);
    await page.goto('/ops', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'POTG Image Parser' })).toBeVisible();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Drop POTG graphic or click to upload').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: '1a6b9a95-405b-471f-abaf-faf66ece4646.jpg',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });

    await expect(page.getByText('Data extracted — review below')).toBeVisible();
    await page.getByRole('button', { name: 'Submit to Data Pipeline' }).click();
    
    await expect(page.getByText('needs_review')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('published', { exact: true }).first()).toBeVisible();

    await expect.poll(() => captures.mediaFeed.length).toBeGreaterThan(0);

    await page.goto('/media', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
    await expect(page.getByText(/Media feed unavailable/i)).toHaveCount(0);
    await expect(page.getByLabel('Share').first()).toBeVisible();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Media' })).toBeVisible();

    await page.goto('/ops', { waitUntil: 'domcontentloaded' });

    expect(captures.presignRequests.length).toBeGreaterThan(0);
    expect(captures.submitRequests.length).toBeGreaterThan(0);
    expect(captures.presignRequests.every((request) => Boolean(request.idempotency))).toBeTruthy();
    expect(captures.mediaFeed.some((asset) => asset.id === 'media-job-potg-001')).toBeTruthy();


    expect(
      captures.potgUploadDimensions.some((dimensions) => dimensions.width === 560 && dimensions.height === 747),
    ).toBeTruthy();
  });
});
