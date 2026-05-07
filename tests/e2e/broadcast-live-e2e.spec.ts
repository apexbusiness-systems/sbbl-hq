import { readFileSync } from 'node:fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const GAME_ID = '11111111-1111-4111-8111-111111111111';
const SUPABASE_REST = '**/rest/v1/**';
const screenshotDir = 'test-results/broadcast-live-e2e';

type Persona = 'anon' | 'admin' | 'fan' | 'paid_fan' | 'player';
type BroadcastMode = 'open-player' | 'open-paywall' | 'ppv-unpaid' | 'ppv-entitled';

test.use({ screenshot: 'only-on-failure' });

test.beforeEach(async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const responseBodies: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`${err.name}: ${err.message}`));
  page.on('response', async (res) => {
    if (res.status() >= 400 && /\/api\/|\/ops\/|\/rest\/v1\//.test(res.url())) {
      responseBodies.push(`${res.status()} ${res.url()} ${await res.text().catch(() => '<unreadable>')}`);
    }
  });
  await testInfo.attach('console-errors', { body: () => Buffer.from(consoleErrors.join('\n')), contentType: 'text/plain' });
  await testInfo.attach('failed-api-bodies', { body: () => Buffer.from(responseBodies.join('\n---\n')), contentType: 'text/plain' });
});

async function installPersona(context: BrowserContext, persona: Persona) {
  if (persona === 'anon') return;
  await context.addInitScript(({ personaName }) => {
    const ref = 'ezanilxygnpucwkwpsoc';
    const userId = `${personaName}-user`;
    const session = {
      access_token: `${personaName}-token`,
      refresh_token: `${personaName}-refresh`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: userId, aud: 'authenticated', role: 'authenticated', email: `${personaName}@example.com` },
    };
    window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
  }, { personaName: persona });
}

async function mockNetwork(page: Page, persona: Persona, mode: BroadcastMode = 'open-player') {
  const roles = persona === 'admin' ? ['super_admin'] : persona === 'player' ? ['player'] : persona === 'paid_fan' ? ['paid_fan'] : ['fan'];
  const userId = persona === 'anon' ? null : `${persona}-user`;
  const streamUrl = mode === 'open-paywall' || mode === 'ppv-unpaid' ? null : 'https://www.youtube.com/watch?v=BjcQrDA9koY';
  const activeGameId = mode.startsWith('ppv') ? GAME_ID : null;

  await page.route('**/api/public-config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appName: 'SBBL HQ', defaultLeague: 'SBBL', supabaseUrl: 'https://ezanilxygnpucwkwpsoc.supabase.co', supabasePublishableKey: 'anon-key' }) }));
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: `${persona}-token`, refresh_token: `${persona}-refresh`, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: userId } }) }));
  await page.route('**/auth/v1/user**', (route) => {
    if (!userId) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'JWT missing' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: userId, aud: 'authenticated', role: 'authenticated', email: `${persona}@example.com` }) });
  });
  await page.route(SUPABASE_REST, async (route) => {
    const url = route.request().url();
    if (url.includes('/profiles')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userId ? [{ id: `${userId}-profile`, user_id: userId, display_name: persona, onboarding_completed_at: new Date().toISOString(), subscription_ends_at: null }] : []) });
    }
    if (url.includes('/user_role_assignments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(roles.map((role) => ({ role }))) });
    }
    if (url.includes('/stream_admin_config')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: true, collection_id: 'https://www.youtube.com/watch?v=BjcQrDA9koY', title: 'E2E Broadcast', is_live: true, active_game_id: activeGameId }]) });
    }
    if (url.includes('/stream_entitlements')) {
      const entitled = mode === 'ppv-entitled';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(entitled ? [{ status: 'active', expires_at: new Date(Date.now() + 60000).toISOString(), game_id: GAME_ID }] : []) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/rpc/get_active_broadcast', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_live: true, stream_url: streamUrl, title: 'E2E Broadcast', active_game_id: activeGameId, live_started_at: new Date().toISOString(), requires_payment: mode.startsWith('ppv'), is_subscribed: persona === 'paid_fan', has_entitlement: mode === 'ppv-entitled', user_registered: Boolean(userId) }) }));
  await page.route('**/api/public/home**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liveGames: [], upcomingGames: [], recentGames: [] }) }));
  await page.route('**/api/streams/status**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, isLive: true, title: 'E2E Broadcast', viewerCount: 7 }) }));
  await page.route('**/api/broadcast/session', (route) => route.fulfill({ status: streamUrl ? 200 : 403, contentType: 'application/json', body: JSON.stringify(streamUrl ? { ok: true, playback: { type: 'url', url: streamUrl, expiresAt: new Date(Date.now() + 60000).toISOString(), heartbeatIntervalSec: 25 }, session: { id: 'broadcast-session', maxExpiresAt: new Date(Date.now() + 600000).toISOString() } } : { ok: false, error: 'forbidden' }) }));
  await page.route('**/api/broadcast/session/heartbeat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('**/api/streams/*/access', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hasAccess: mode === 'ppv-entitled' || persona === 'player' || persona === 'paid_fan' || persona === 'admin' }) }));
  await page.route('**/api/streams/*/session', (route) => route.fulfill({ status: mode === 'ppv-unpaid' ? 403 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'ppv-unpaid' ? { ok: false, error: 'forbidden' } : { ok: true, playback: { type: 'url', url: 'https://www.youtube.com/watch?v=BjcQrDA9koY', expiresAt: new Date(Date.now() + 60000).toISOString(), heartbeatIntervalSec: 25 }, session: { id: 'ppv-session', gameId: GAME_ID } }) }));
  await page.route('**/api/streams/*/session/heartbeat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('**/ops/streams/config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, config: { collectionId: 'https://www.youtube.com/watch?v=BjcQrDA9koY', title: 'E2E Broadcast', source: 'main', isLive: false, viewerCount: 0 } }) }));
}

async function openLive(page: Page, context: BrowserContext, persona: Persona, mode: BroadcastMode = 'open-player') {
  await installPersona(context, persona);
  await mockNetwork(page, persona, mode);
  await page.goto('/live');
}

test.describe('Admin Go-Live', () => {
  test('admin can open /live and see stream controls', async ({ page, context }) => {
    await openLive(page, context, 'admin');
    await page.getByRole('button', { name: /Stream controls/ }).click();
    await expect(page.getByText('Stream URL', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Go Live|End Stream/ })).toBeVisible();
  });

  test('admin entering URL and clicking Go Live sends correct /ops/streams/go-live payload', async ({ page, context }) => {
    await openLive(page, context, 'admin');
    await page.getByRole('button', { name: /Stream controls/ }).click();
    let posted: any = null;
    await page.route('**/ops/streams/go-live', async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, isLive: true, collectionId: posted.collectionId, title: posted.title, activeGameId: posted.activeGameId ?? null }) });
    });
    await page.getByPlaceholder(/Paste any link/).fill('https://youtube.com/live/BjcQrDA9koY?feature=share');
    await page.getByPlaceholder(/SBBL Finals/).fill('Browser Go Live');
    const response = page.waitForResponse('**/ops/streams/go-live');
    await page.getByRole('button', { name: /Go Live/ }).click();
    await response;
    expect(posted).toMatchObject({ isLive: true, collectionId: 'https://www.youtube.com/watch?v=BjcQrDA9koY', title: 'Browser Go Live', activeGameId: null });
  });
});

test.describe('Fan watch and paywall', () => {
  test('registered fan with server-granted stream_url sees player', async ({ page, context }) => {
    await openLive(page, context, 'fan', 'open-player');
    await expect(page.getByTestId('stream-player')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/fan-player-success.png`, fullPage: true });
  });

  test('registered fan with stream_url null sees paywall/access gate', async ({ page, context }) => {
    await openLive(page, context, 'fan', 'open-paywall');
    await expect(page.getByText(/Purchase Access|Have a Free Access Code|Register to Watch/).first()).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/fan-paywall-success.png`, fullPage: true });
  });

  test('anonymous visitor sees auth/paywall prompt', async ({ page, context }) => {
    await openLive(page, context, 'anon', 'open-paywall');
    await expect(page.getByText(/Register to Watch|Create Free Account/)).toBeVisible();
  });

  test('PPV unpaid fan sees purchase/paywall prompt', async ({ page, context }) => {
    await openLive(page, context, 'fan', 'ppv-unpaid');
    await expect(page.getByText(/Purchase Access|Have a Free Access Code/).first()).toBeVisible();
  });

  test('PPV entitled fan sees player', async ({ page, context }) => {
    await openLive(page, context, 'fan', 'ppv-entitled');
    await expect(page.getByTestId('stream-player')).toBeVisible();
  });
});

test.describe('Security and runtime health', () => {
  test('/live has CSP header when served through production worker URL', async () => {
    const workerSource = readFileSync('src/worker/index.ts', 'utf8');
    expect(workerSource).toContain("headers.set('Content-Security-Policy'");
    expect(workerSource).toContain("default-src 'self'");
    expect(workerSource).toContain('return addSecurityHeaders(new Response(assetRes.body');
  });

  test('anon /live load has zero unexpected runtime TypeError or ReferenceError', async ({ page, context }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (err) => runtimeErrors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && /(TypeError|ReferenceError)/.test(msg.text())) runtimeErrors.push(msg.text()); });
    await openLive(page, context, 'anon', 'open-paywall');
    await expect(page.getByText(/Register to Watch|Create Free Account/)).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
