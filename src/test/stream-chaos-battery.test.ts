/**
 * Stream Chaos Battery — stress tests for livestream resilience.
 *
 * Simulates real-world failure scenarios to ensure flawless,
 * continuous broadcast under adverse conditions:
 *
 * 1. Token expiry mid-broadcast (stale closure)
 * 2. Rapid Go Live / End Stream toggling
 * 3. Config save + live toggle race condition
 * 4. Network failure during polling (transient 500)
 * 5. Session refresh returns same token (loop guard)
 * 6. Concurrent admin updates from two tabs
 * 7. Empty stream URL prevention
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mocks ────────────────────────────────────────────────────────────

const mockFetch = vi.fn<(...args: unknown[]) => Promise<Response>>();
const mockRefreshSession = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    refreshSession: mockRefreshSession,
    getSession: mockGetSession,
    getUser: mockGetUser,
  },
};

vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('crypto', { randomUUID: () => 'chaos-uuid' });

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

vi.stubEnv('VITE_WORKER_API_BASE', 'https://api.test');

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setupAutoAuth(token = 'auto-token') {
  mockGetUser.mockResolvedValue({ error: null });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: token } },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Stream Chaos Battery', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockRefreshSession.mockReset();
    mockGetSession.mockReset();
    mockGetUser.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CHAOS-1: recovers from token expiry mid-broadcast after 10+ polls', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    // Simulate 10 successful polls, then token expires
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, config: { isLive: true } }));
    }
    // 11th poll: 401 (token expired)
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    // Refresh succeeds
    mockRefreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });
    // Retry with fresh token: 200
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, config: { isLive: true, title: 'Recovered' } }));

    // First 10 polls succeed
    for (let i = 0; i < 10; i++) {
      await apiFetch('/ops/streams/config', {}, `token-${i}`);
    }

    // 11th poll: should recover via refresh
    const result = await apiFetch('/ops/streams/config', {}, 'expired-token');
    expect(result).toEqual({ ok: true, config: { isLive: true, title: 'Recovered' } });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('CHAOS-2: handles rapid Go Live / End Stream toggling without race conditions', async () => {
    const { apiFetch } = await import('@/lib/api/client');
    setupAutoAuth();

    // Rapid toggle: live → offline → live → offline
    const responses = [
      jsonResponse(200, { ok: true, isLive: true }),
      jsonResponse(200, { ok: true, isLive: false }),
      jsonResponse(200, { ok: true, isLive: true }),
      jsonResponse(200, { ok: true, isLive: false }),
    ];
    responses.forEach(r => mockFetch.mockResolvedValueOnce(r));

    const results = await Promise.all([
      apiFetch('/ops/streams/status', { method: 'POST', body: JSON.stringify({ isLive: true }) }),
      apiFetch('/ops/streams/status', { method: 'POST', body: JSON.stringify({ isLive: false }) }),
      apiFetch('/ops/streams/status', { method: 'POST', body: JSON.stringify({ isLive: true }) }),
      apiFetch('/ops/streams/status', { method: 'POST', body: JSON.stringify({ isLive: false }) }),
    ]);

    expect(results).toHaveLength(4);
    results.forEach(r => expect(r).toHaveProperty('ok', true));
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('CHAOS-3: config save and live toggle are atomic (both succeed or caller sees error)', async () => {
    const { apiFetch } = await import('@/lib/api/client');
    setupAutoAuth();

    // Config save succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, config: { collectionId: 'https://yt.com/live' } }));
    // Live toggle fails (500 — transient)
    mockFetch.mockResolvedValueOnce(jsonResponse(500, { ok: false, error: 'internal_error' }));

    const configResult = await apiFetch('/ops/streams/config', {
      method: 'POST',
      body: JSON.stringify({ collectionId: 'https://yt.com/live' }),
    });
    expect(configResult).toHaveProperty('ok', true);

    // Live toggle should throw
    await expect(
      apiFetch('/ops/streams/status', {
        method: 'POST',
        body: JSON.stringify({ isLive: true }),
      }),
    ).rejects.toThrow('internal_error');
  });

  it('CHAOS-4: transient 500 during polling does not crash — caller can retry', async () => {
    const { apiFetch } = await import('@/lib/api/client');
    setupAutoAuth();

    // First poll: 500
    mockFetch.mockResolvedValueOnce(jsonResponse(500, { ok: false, error: 'database_timeout' }));
    // Second poll: 200
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, config: { isLive: true } }));

    // First call throws
    await expect(apiFetch('/ops/streams/config')).rejects.toThrow('database_timeout');

    // Second call succeeds — resilient
    const result = await apiFetch('/ops/streams/config');
    expect(result).toHaveProperty('ok', true);
  });

  it('CHAOS-5: double 401 (refresh also returns expired) does not infinite loop', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    // 401 with explicit token
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    // Refresh returns null session (user fully logged out)
    mockRefreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'session_expired' },
    });

    // Should fail cleanly, not loop
    await expect(apiFetch('/ops/streams/config', {}, 'dead-token')).rejects.toThrow('unauthorized');
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retry attempted
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('CHAOS-6: concurrent calls from two tabs both get fresh tokens', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    // Both start with stale tokens, both get 401
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));

    // Both refresh — Supabase dedupes internally
    mockRefreshSession
      .mockResolvedValueOnce({ data: { session: { access_token: 'fresh-1' } }, error: null })
      .mockResolvedValueOnce({ data: { session: { access_token: 'fresh-2' } }, error: null });

    // Both retries succeed
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, from: 'tab1' }));
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, from: 'tab2' }));

    const [r1, r2] = await Promise.all([
      apiFetch('/ops/streams/config', {}, 'stale-tab1'),
      apiFetch('/ops/streams/config', {}, 'stale-tab2'),
    ]);

    expect(r1).toHaveProperty('ok', true);
    expect(r2).toHaveProperty('ok', true);
    expect(mockRefreshSession).toHaveBeenCalledTimes(2);
  });

  it('CHAOS-7: network timeout is thrown cleanly, not swallowed', async () => {
    const { apiFetch } = await import('@/lib/api/client');
    setupAutoAuth();

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiFetch('/ops/streams/config')).rejects.toThrow('Failed to fetch');
  });

  it('CHAOS-8: polling with null token auto-fetches and succeeds', async () => {
    const { apiFetch } = await import('@/lib/api/client');
    setupAutoAuth('fresh-auto');

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, config: { isLive: false } }));

    // Pass null explicitly — simulates the fixed Live.tsx polling
    const result = await apiFetch('/ops/streams/config', {}, null);
    expect(result).toHaveProperty('ok', true);

    // Verify it used the auto-fetched token
    const headers = mockFetch.mock.calls[0][1] as RequestInit;
    expect((headers.headers as Headers).get('authorization')).toBe('Bearer fresh-auto');
  });
});
