/**
 * Ops Chaos Battery
 *
 * Stress-tests auth recovery, ingest idempotency, and fail-closed behavior.
 * This suite is intentionally adversarial to detect regressions at the auth
 * boundary and upload control plane before production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `chaos-uuid-${++uuidCounter}`,
});

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

describe('ops chaos battery', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockRefreshSession.mockReset();
    mockGetSession.mockReset();
    mockGetUser.mockReset();
    mockSignOut.mockReset();
    uuidCounter = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('storm-1: sustained 401 turbulence recovers without local sign-out', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    const responses: Response[] = [];
    for (let i = 1; i <= 20; i += 1) {
      if (i % 5 === 0) {
        responses.push(jsonResponse(401, { ok: false, error: 'unauthorized' }));
        responses.push(jsonResponse(200, { ok: true, index: i, recovered: true }));
      } else {
        responses.push(jsonResponse(200, { ok: true, index: i }));
      }
    }

    mockFetch.mockImplementation(async () => responses.shift() ?? jsonResponse(500, { ok: false, error: 'missing_mock' }));

    let refreshCount = 0;
    mockRefreshSession.mockImplementation(async () => ({
      data: { session: { access_token: `fresh-token-${++refreshCount}` } },
      error: null,
    }));

    const results: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 20; i += 1) {
      const result = await apiFetch<Record<string, unknown>>('/ops/bootstrap', {}, `stale-${i}`);
      results.push(result);
    }

    expect(results).toHaveLength(20);
    expect(results.every((result) => result.ok === true)).toBeTruthy();
    expect(refreshCount).toBe(4);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('storm-2: concurrent ingest presign requests carry unique idempotency keys', async () => {
    const { ingestPresign } = await import('@/lib/api/ops');

    mockGetUser.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'auto-token' } },
    });

    const seenKeys = new Set<string>();

    mockFetch.mockImplementation(async (_url, init) => {
      const headers = init && typeof init === 'object' ? (init as RequestInit).headers : undefined;
      const key = headers instanceof Headers
        ? headers.get('x-idempotency-key')
        : new Headers(headers as HeadersInit | undefined).get('x-idempotency-key');

      expect(key).toBeTruthy();
      seenKeys.add(String(key));

      return jsonResponse(200, {
        ok: true,
        signedUrl: 'https://upload.test/object',
        token: 'token-test',
        objectPath: 'potg/object-test.jpg',
      });
    });

    const calls = Array.from({ length: 24 }, (_value, index) =>
      ingestPresign('potg', `stress-${index}.png`),
    );

    const results = await Promise.all(calls);

    expect(results).toHaveLength(24);
    expect(results.every((result) => result.ok === true)).toBeTruthy();
    expect(seenKeys.size).toBe(24);
  });

  it('storm-3: persistent unauthorized responses fail closed under concurrency', async () => {
    const { apiFetch } = await import('@/lib/api/client');

    mockFetch.mockResolvedValue(jsonResponse(401, { ok: false, error: 'unauthorized' }));
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'session_expired' },
    });

    const calls = Array.from({ length: 8 }, (_value, index) =>
      apiFetch('/ops/imports/history', {}, `dead-${index}`),
    );

    const settled = await Promise.allSettled(calls);

    expect(settled).toHaveLength(8);
    expect(settled.every((entry) => entry.status === 'rejected')).toBeTruthy();
    expect(mockSignOut).toHaveBeenCalledTimes(8);
  });
});
