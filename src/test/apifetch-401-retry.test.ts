/**
 * Regression tests for apiFetch 401 retry with stale tokens.
 *
 * Root cause: When callers pass an explicit `token` (e.g. from a React
 * useAuth() closure), the token can expire between re-renders. Previously,
 * apiFetch only retried 401s when NO explicit token was passed (`!token`),
 * so stale explicit tokens caused infinite 401 loops with no recovery.
 *
 * Fix: apiFetch now always retries on 401, refreshing the session regardless
 * of whether the token was explicit or auto-fetched.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockFetch = vi.fn<(...args: unknown[]) => Promise<Response>>();

const mockRefreshSession = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockSupabaseClient = {
  auth: {
    refreshSession: mockRefreshSession,
    getSession: mockGetSession,
    getUser: mockGetUser,
    signOut: mockSignOut,
  },
};

vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

// Provide VITE_WORKER_API_BASE for import.meta.env
vi.stubEnv('VITE_WORKER_API_BASE', 'https://api.test');

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('apiFetch 401 retry guard', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockRefreshSession.mockReset();
    mockGetSession.mockReset();
    mockGetUser.mockReset();
    mockSignOut.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries with refreshed token when explicit token gets 401', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    // First call: 401 (stale explicit token)
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    // After refresh: 200
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, data: 'success' }));

    mockRefreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    });

    const result = await apiFetch('/test', {}, 'stale-token');

    expect(result).toEqual({ ok: true, data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    // Verify first call used stale token
    const firstCallHeaders = mockFetch.mock.calls[0][1] as RequestInit;
    expect((firstCallHeaders.headers as Headers).get('authorization')).toBe('Bearer stale-token');

    // Verify retry used fresh token
    const retryHeaders = mockFetch.mock.calls[1][1] as RequestInit;
    expect((retryHeaders.headers as Headers).get('authorization')).toBe('Bearer fresh-token');
  });

  it('retries with refreshed token when auto-fetched token gets 401', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    // getAuthToken flow: getUser + getSession
    mockGetUser.mockResolvedValueOnce({ error: null });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'auto-token' } },
    });

    // First call: 401
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    // After refresh: 200
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, data: 'refreshed' }));

    mockRefreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });

    const result = await apiFetch('/test');

    expect(result).toEqual({ ok: true, data: 'refreshed' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('fails closed with reauth_required after retry also returns 401', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));

    mockRefreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'stale-token' } },
      error: null,
    });

    await expect(apiFetch('/test', {}, 'stale-token')).rejects.toThrow('reauth_required');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('fails closed with reauth_required when refresh fails', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    mockFetch.mockResolvedValueOnce(jsonResponse(401, { ok: false, error: 'unauthorized' }));

    mockRefreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'refresh_failed' },
    });

    await expect(apiFetch('/test', {}, 'stale-token')).rejects.toThrow('reauth_required');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('succeeds without retry when token is valid', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true, data: 'direct' }));

    const result = await apiFetch('/test', {}, 'valid-token');

    expect(result).toEqual({ ok: true, data: 'direct' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
