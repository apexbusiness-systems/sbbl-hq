import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const SUPABASE_REF = 'ezanilxygnpucwkwpsoc';
const SUPABASE_REST = '**/rest/v1/**';
const ARTIFACT_ROOT = 'artifacts/broadcast-evidence';
const SCREENSHOT_DIR = `${ARTIFACT_ROOT}/screenshots`;
const NETWORK_DIR = `${ARTIFACT_ROOT}/network-logs`;
const MANIFEST_PATH = `${ARTIFACT_ROOT}/manifest.json`;
const BROADCAST_SOURCE_URL = 'https://www.youtube.com/watch?v=BjcQrDA9koY';
const PLAYBACK_URL = 'https://www.youtube.com/watch?v=BjcQrDA9koY';
const GAME_ID = '11111111-1111-4111-8111-111111111111';
const NOW_ISO = '2026-05-09T00:00:00.000Z';

type Persona = 'anon' | 'fan' | 'entitled' | 'admin';
type ScenarioResult = 'PASS' | 'FAIL' | 'PARTIAL';

type NetworkEntry = {
  method: string;
  url: string;
  status?: number;
  requestPostData?: string | null;
  responseBody?: unknown;
};

type ScenarioEvidence = {
  name: string;
  result: ScenarioResult;
  screenshots: string[];
  networkLog: string;
  assertions: string[];
  notes: string[];
};

const scenarioEvidence: ScenarioEvidence[] = [];
const skippedReasons: string[] = [];

function ensureArtifactDirs() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  mkdirSync(NETWORK_DIR, { recursive: true });
}

function findFiles(root: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(full, predicate));
    if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out.sort();
}

function redactBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body.slice(0, 2_000);
  }
}

function bodyContainsForbiddenValue(body: unknown): boolean {
  const text = JSON.stringify(body ?? null).toLowerCase();
  return [
    PLAYBACK_URL.toLowerCase(),
    BROADCAST_SOURCE_URL.toLowerCase(),
    'playback.url',
    'collection_id',
    'collectionid',
    'service_role',
    'service-role',
    'private-provider-token',
    'stream_admin_config',
    'supabase_service_role',
  ].some((needle) => text.includes(needle));
}

function assertBlockedResponsesDidNotLeak(network: NetworkEntry[]) {
  const apiResponses = network.filter((entry) =>
    /\/api\/|\/ops\/|\/rest\/v1\//.test(entry.url) && entry.responseBody !== undefined,
  );
  const leaks = apiResponses.filter((entry) => bodyContainsForbiddenValue(entry.responseBody));
  expect(leaks, JSON.stringify(leaks, null, 2)).toEqual([]);
  expect(apiResponses.some((entry) => /\/api\/broadcast\/session(?:\?|$)/.test(entry.url))).toBe(false);
}

function recordScenario(evidence: ScenarioEvidence) {
  scenarioEvidence.push(evidence);
}

async function captureScenarioScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(existsSync(screenshotPath)).toBe(true);
  return screenshotPath;
}

async function writeNetworkLog(name: string, entries: NetworkEntry[]): Promise<string> {
  const logPath = `${NETWORK_DIR}/${name}.json`;
  writeFileSync(logPath, JSON.stringify(entries, null, 2));
  expect(existsSync(logPath)).toBe(true);
  return logPath;
}

async function installPersona(page: Page, persona: Persona) {
  await page.addInitScript(({ personaName, ref }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        window.dispatchEvent(new CustomEvent('sbbl:e2e-media-play'));
        return Promise.resolve();
      },
    });
    void navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
      for (const registration of registrations) void registration.unregister();
    });
    if (personaName === 'anon') return;

    const userId = `${personaName}-user`;
    window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: `${personaName}-token`,
      refresh_token: `${personaName}-refresh`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: `${personaName}@example.com`,
      },
    }));
  }, { personaName: persona, ref: SUPABASE_REF });
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBroadcastNetwork(page: Page, persona: Persona, network: NetworkEntry[]) {
  const userId = persona === 'anon' ? null : `${persona}-user`;
  const roles = persona === 'admin' ? ['super_admin'] : ['fan'];
  const entitled = persona === 'entitled';
  const admin = persona === 'admin';
  const blocked = persona === 'anon' || persona === 'fan';

  page.on('request', (request) => {
    if (/\/api\/|\/ops\/|\/rest\/v1\//.test(request.url())) {
      network.push({ method: request.method(), url: request.url(), requestPostData: request.postData() });
    }
  });

  page.on('response', async (response) => {
    if (!/\/api\/|\/ops\/|\/rest\/v1\//.test(response.url())) return;
    const entry = [...network].reverse().find((item) => item.url === response.url() && item.status === undefined);
    if (!entry) return;
    entry.status = response.status();
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      entry.responseBody = redactBody(await response.text().catch(() => '<unreadable>'));
    }
  });

  await page.route('**/api/public-config', (route) => fulfillJson(route, 200, {
    ok: true,
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
    supabaseUrl: `https://${SUPABASE_REF}.supabase.co`,
    supabasePublishableKey: 'anon-key',
  }));

  await page.route('**/auth/v1/token**', (route) => fulfillJson(route, userId ? 200 : 401, userId ? {
    access_token: `${persona}-token`,
    refresh_token: `${persona}-refresh`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId },
  } : { message: 'JWT missing' }));

  await page.route('**/auth/v1/user**', (route) => {
    if (!userId) return fulfillJson(route, 401, { message: 'JWT missing' });
    return fulfillJson(route, 200, { id: userId, aud: 'authenticated', role: 'authenticated', email: `${persona}@example.com` });
  });

  // Abort Realtime WebSocket — it keeps a persistent WS connection that prevents
  // networkidle from ever resolving and makes waitForResponse hang indefinitely.
  await page.route('**/realtime/v1/**', (route) => route.abort());

  await page.route(SUPABASE_REST, async (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/redeem_ppv_invite')) return fulfillJson(route, 200, { ok: true });
    if (url.includes('/profiles')) {
      return fulfillJson(route, 200, userId ? [{
        id: `${userId}-profile`,
        user_id: userId,
        display_name: persona,
        full_name: `${persona} User`,
        preferred_league: 'SBBL',
        onboarding_completed_at: NOW_ISO,
        subscription_ends_at: null,
      }] : []);
    }
    if (url.includes('/user_role_assignments')) {
      return fulfillJson(route, 200, roles.map((role) => ({ role })));
    }
    if (url.includes('/stream_entitlements')) {
      return fulfillJson(route, 200, entitled ? [{ id: 'entitlement-1', status: 'active', expires_at: '2026-05-10T00:00:00.000Z' }] : []);
    }
    if (url.includes('/stream_admin_config')) {
      return fulfillJson(route, admin ? 200 : 403, admin ? [{
        id: true,
        collection_id: BROADCAST_SOURCE_URL,
        title: 'Evidence Broadcast',
        is_live: !admin,
        active_game_id: null,
      }] : { error: 'forbidden' });
    }
    return fulfillJson(route, 200, []);
  });

  // Dedicated sync route for get_active_broadcast — registered after the SUPABASE_REST
  // catch-all so Playwright's LIFO ordering picks this one first, ensuring the response
  // is synchronous and waitForResponse resolves promptly.
  const broadcastBase = {
    is_live: true, title: 'Evidence Broadcast', active_game_id: null,
    live_started_at: NOW_ISO, requires_payment: true, is_subscribed: false,
    has_entitlement: entitled, user_registered: Boolean(userId),
  };
  await page.route('**/rpc/get_active_broadcast**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        entitled || admin ? { ...broadcastBase, stream_url: BROADCAST_SOURCE_URL } : broadcastBase,
      ),
    }),
  );

  await page.route('**/api/public/home**', (route) => fulfillJson(route, 200, {
    ok: true,
    liveGames: [],
    upcomingGames: [],
    recentGames: [],
  }));

  await page.route('**/api/streams/status**', (route) => fulfillJson(route, 200, {
    ok: true,
    isLive: true,
    title: 'Evidence Broadcast',
    viewerCount: 7,
    gameId: null,
  }));

  await page.route('**/ops/streams/config**', (route) => fulfillJson(route, 200, {
    ok: true,
    config: {
      collectionId: BROADCAST_SOURCE_URL,
      title: 'Evidence Broadcast',
      source: 'main',
      isLive: !admin,
      activeGameId: null,
    },
  }));

  await page.route('**/ops/streams/go-live', async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    expect(payload).toMatchObject({
      isLive: true,
      collectionId: BROADCAST_SOURCE_URL,
      title: 'Evidence Broadcast From /live',
      activeGameId: null,
    });
    return fulfillJson(route, 200, {
      ok: true,
      isLive: true,
      title: payload.title,
      collectionId: payload.collectionId,
      activeGameId: null,
      sync: { ok: true, function: 'admin_sync_broadcast_to_sessions' },
    });
  });

  await page.route('**/api/broadcast/session', (route) => {
    if (blocked) return fulfillJson(route, 403, { ok: false, error: 'forbidden' });
    return fulfillJson(route, 200, {
      ok: true,
      playback: {
        type: 'url',
        url: PLAYBACK_URL,
        expiresAt: '2026-05-09T01:00:00.000Z',
        heartbeatIntervalSec: 1,
      },
      session: {
        id: `${persona}-broadcast-session`,
        maxExpiresAt: '2026-05-09T06:00:00.000Z',
      },
    });
  });

  await page.route('**/api/broadcast/session/heartbeat', (route) => fulfillJson(route, 200, { ok: true }));
  await page.route('**/api/broadcast/session/end', (route) => fulfillJson(route, 200, { ok: true }));
}

async function openLive(page: Page, persona: Persona, network: NetworkEntry[]) {
  await installPersona(page, persona);
  await mockBroadcastNetwork(page, persona, network);
  // Register the response waiter BEFORE goto so we don't miss the request.
  // Admin doesn't call get_active_broadcast (isSuperAdmin gates it); wait for
  // the ops/streams/config fetch instead.
  const readySignal = persona === 'admin'
    ? page.waitForResponse('**/ops/streams/config**', { timeout: 12_000 }).catch(() => null)
    : page.waitForResponse('**/rpc/get_active_broadcast**', { timeout: 12_000 }).catch(() => null);
  await page.goto('/live');
  await readySignal;
}

test.use({ screenshot: 'only-on-failure', serviceWorkers: 'block', trace: 'on' });
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  ensureArtifactDirs();
});

test.afterAll(() => {
  ensureArtifactDirs();
  const screenshots = findFiles(SCREENSHOT_DIR, (file) => file.endsWith('.png'));
  const networkLogs = findFiles(NETWORK_DIR, (file) => file.endsWith('.json'));
  const traces = findFiles('test-results', (file) => file.endsWith('.zip'));
  const hasFailure = scenarioEvidence.some((scenario) => scenario.result === 'FAIL');
  const hasPartial = skippedReasons.length > 0 || scenarioEvidence.some((scenario) => scenario.result === 'PARTIAL');
  const passFail: ScenarioResult = hasFailure ? 'FAIL' : hasPartial ? 'PARTIAL' : 'PASS';

  const manifest = {
    commitSha: process.env.GITHUB_SHA ?? 'local',
    runTimestamp: new Date().toISOString(),
    testedScenarios: scenarioEvidence.map(({ name, result, assertions, notes }) => ({ name, result, assertions, notes })),
    screenshots,
    traces,
    networkAssertions: scenarioEvidence.flatMap((scenario) => scenario.assertions),
    networkLogs,
    passFail,
    skippedReasons,
    environment: {
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
      ci: Boolean(process.env.CI),
      browser: 'chromium',
    },
    notes: [
      'Blocked personas are asserted against API/REST response bodies for stream_url/playback.url/collection_id/service-role leaks.',
      'Entitled persona receives playback.url only from /api/broadcast/session after server-granted access.',
      'Open broadcast session routes remain /api/broadcast/session, never /api/streams/broadcast/session.',
    ],
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  expect(screenshots.length).toBeGreaterThanOrEqual(4);
  expect(networkLogs.length).toBeGreaterThanOrEqual(4);
  expect(manifest.passFail).toBe('PASS');
});

test('super_admin ingests a supported broadcast link from /live and syncs broadcast state', async ({ page }) => {
  const network: NetworkEntry[] = [];
  await openLive(page, 'admin', network);

  await page.getByRole('button', { name: /Stream controls/i }).click();
  await page.getByPlaceholder(/Paste any link/i).fill('https://youtube.com/live/BjcQrDA9koY?feature=share');
  await page.getByPlaceholder(/SBBL Finals/i).fill('Evidence Broadcast From /live');
  const goLive = page.waitForResponse('**/ops/streams/go-live');
  await page.getByRole('button', { name: /Go Live/i }).click();
  const response = await goLive;
  expect(response.ok()).toBe(true);
  const screenshot = await captureScenarioScreenshot(page, '01-super-admin-go-live-sync');
  const networkLog = await writeNetworkLog('01-super-admin-go-live-sync', network);

  expect(network.some((entry) => entry.url.includes('/ops/streams/go-live'))).toBe(true);
  expect(network.some((entry) => entry.url.includes('/api/streams/broadcast/session'))).toBe(false);

  recordScenario({
    name: 'super_admin_ingest_and_broadcast_sync',
    result: 'PASS',
    screenshots: [screenshot],
    networkLog,
    assertions: [
      'super_admin submitted normalized YouTube URL through /live Broadcast Controls.',
      'Go Live used activeGameId=null and included admin_sync_broadcast_to_sessions acknowledgement.',
      'Open broadcast did not use /api/streams/broadcast/session.',
    ],
    notes: [],
  });
});

test('anonymous live viewer is blocked and receives no playback secrets', async ({ page }) => {
  const network: NetworkEntry[] = [];
  await openLive(page, 'anon', network);

  await expect(page.getByText(/Register to Watch/i).first()).toBeVisible();
  await expect(page.getByText(/Create a free account/i).first()).toBeVisible();
  assertBlockedResponsesDidNotLeak(network);

  const screenshot = await captureScenarioScreenshot(page, '02-anonymous-paywall-blocked');
  const networkLog = await writeNetworkLog('02-anonymous-paywall-blocked', network);
  recordScenario({
    name: 'anonymous_blocked_no_stream_url_or_playback_url',
    result: 'PASS',
    screenshots: [screenshot],
    networkLog,
    assertions: [
      'Anonymous viewer saw registration/paywall gate.',
      'Anonymous network responses contained no stream_url value, playback.url, collection_id, provider source URL, or service-role data.',
      'Anonymous viewer never called /api/broadcast/session.',
    ],
    notes: [],
  });
});

test('registered unpaid live viewer is blocked and receives no playback secrets', async ({ page }) => {
  const network: NetworkEntry[] = [];
  await openLive(page, 'fan', network);

  await expect(page.getByText(/Have a Free Access Code/i)).toBeVisible();
  await expect(page.getByText(/Purchase Access/i)).toBeVisible();
  assertBlockedResponsesDidNotLeak(network);

  const screenshot = await captureScenarioScreenshot(page, '03-registered-unpaid-paywall-blocked');
  const networkLog = await writeNetworkLog('03-registered-unpaid-paywall-blocked', network);
  recordScenario({
    name: 'registered_unpaid_blocked_no_stream_url_or_playback_url',
    result: 'PASS',
    screenshots: [screenshot],
    networkLog,
    assertions: [
      'Registered unpaid viewer completed deterministic onboarding profile fixture.',
      'Registered unpaid viewer saw code redemption and purchase paywall.',
      'Registered unpaid network responses contained no stream_url value, playback.url, collection_id, provider source URL, or service-role data.',
      'Registered unpaid viewer never called /api/broadcast/session.',
    ],
    notes: [],
  });
});

test('entitled live viewer receives playback only after access grant and completes session lifecycle', async ({ page }) => {
  const network: NetworkEntry[] = [];
  await openLive(page, 'entitled', network);

  await expect(page.getByTestId('stream-player')).toBeVisible();
  await expect(page.getByTestId('stream-player')).toHaveAttribute('data-container-ready', 'true', { timeout: 15_000 });
  const heartbeatResponse = page.waitForResponse('**/api/broadcast/session/heartbeat');
  await page.getByRole('button', { name: /Play playback/i }).click();
  await heartbeatResponse;

  const screenshot = await captureScenarioScreenshot(page, '04-entitled-player-visible');
  const sessionEndResponse = page.waitForResponse('**/api/broadcast/session/end');
  await page.getByRole('link', { name: /^Home$/i }).click();
  await sessionEndResponse;
  const networkLog = await writeNetworkLog('04-entitled-player-session-lifecycle', network);

  const sessionStart = network.find((entry) => /\/api\/broadcast\/session(?:\?|$)/.test(entry.url) && entry.status === 200);
  const heartbeat = network.find((entry) => entry.url.includes('/api/broadcast/session/heartbeat') && entry.status === 200);
  const sessionEnd = network.find((entry) => entry.url.includes('/api/broadcast/session/end') && entry.status === 200);

  expect(sessionStart?.responseBody).toMatchObject({ playback: { url: PLAYBACK_URL } });
  expect(heartbeat).toBeTruthy();
  expect(sessionEnd).toBeTruthy();
  expect(network.some((entry) => entry.url.includes('/api/streams/broadcast/session'))).toBe(false);

  recordScenario({
    name: 'entitled_playback_access_player_render_session_start_heartbeat_end',
    result: 'PASS',
    screenshots: [screenshot],
    networkLog,
    assertions: [
      'Entitled fixture used active stream entitlement status=active.',
      'Entitled viewer received playback.url from /api/broadcast/session only after get_active_broadcast granted stream_url.',
      'Livestream player shell rendered visibly.',
      'Session start, heartbeat, and end endpoints returned success.',
      'Open broadcast lifecycle used /api/broadcast/session, not /api/streams/broadcast/session.',
    ],
    notes: [],
  });
});
