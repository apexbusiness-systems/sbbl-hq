import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

const GAME_ID = 'smoke-game';

test.describe('stream route smoke contract', () => {
  test('public + session + ops routes are reachable on expected surface', async ({ page }) => {
    await seedSuperAdminSession(page);

    const seen: string[] = [];
    await page.route('**/api/streams/status', async (route) => {
      seen.push('/api/streams/status');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, isLive: false, viewerCount: 0, title: 'Smoke' }) });
    });
    await page.route(`**/api/streams/${GAME_ID}/access`, async (route) => {
      seen.push('/api/streams/:gameId/access');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hasAccess: false }) });
    });
    await page.route(`**/api/streams/${GAME_ID}/purchase`, async (route) => {
      seen.push('/api/streams/:gameId/purchase');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route(`**/api/streams/${GAME_ID}/session`, async (route) => {
      seen.push('/api/streams/:gameId/session');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, playback: { type: 'url', url: 'https://example.com/live.m3u8', expiresAt: new Date().toISOString(), heartbeatIntervalSec: 25 }, session: { id: 'sess-1', gameId: GAME_ID } }) });
    });
    await page.route('**/ops/streams/config', async (route) => {
      seen.push('/ops/streams/config');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/ops/streams/status', async (route) => {
      seen.push('/ops/streams/status');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/');
    const responses = await page.evaluate(async ({ gameId }) => {
      const headers = { 'content-type': 'application/json', 'x-idempotency-key': 'e2e-smoke-key-12345' };
      const out = [];
      out.push(await fetch('/api/streams/status').then((r) => r.status));
      out.push(await fetch(`/api/streams/${gameId}/access`).then((r) => r.status));
      out.push(await fetch(`/api/streams/${gameId}/purchase`, { method: 'POST', headers, body: '{}' }).then((r) => r.status));
      out.push(await fetch(`/api/streams/${gameId}/session`, { method: 'POST', headers, body: JSON.stringify({ sessionKey: 'smoke-key-12345' }) }).then((r) => r.status));
      out.push(await fetch('/ops/streams/config', { method: 'POST', headers, body: '{}' }).then((r) => r.status));
      out.push(await fetch('/ops/streams/status', { method: 'POST', headers, body: JSON.stringify({ isLive: false, gameId }) }).then((r) => r.status));
      return out;
    }, { gameId: GAME_ID });

    expect(responses.every((status) => status >= 200 && status < 500)).toBe(true);
    expect(seen).toEqual(expect.arrayContaining([
      '/api/streams/status',
      '/api/streams/:gameId/access',
      '/api/streams/:gameId/purchase',
      '/api/streams/:gameId/session',
      '/ops/streams/config',
      '/ops/streams/status',
    ]));
  });
});
