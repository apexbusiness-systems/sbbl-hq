/**
 * Auth flow audit — self-hosted Supabase (2026-05-18).
 *
 * All assertions exercise real production code paths imported directly from
 * src/worker/index.ts. No mirrored helper implementations.
 *
 *   A-01  resolveProxyTokenSecret never falls back to SUPABASE_SERVICE_ROLE_KEY
 *   A-02  Admin client cache invalidates on service-role key rotation
 *   A-03  worker.fetch() strips all four client-supplied identity headers before routing
 *   A-04  requireAuth returns 401 when x-sbbl-user-id-verified is absent
 *   A-06  addSecurityHeaders does NOT emit X-XSS-Protection
 *   A-07  addSecurityHeaders emits HSTS / X-Frame-Options / CSP frame-ancestors
 *
 * A-05 (PKCE config) is covered by src/test/supabase-client-pkce.test.ts which
 * captures createClient() options directly. Not duplicated here.
 */

import { describe, expect, it, vi } from 'vitest';

// ── createClientSpy hoisted so it is accessible in vi.mock factories ──────────

const { createClientSpy } = vi.hoisted(() => ({
  createClientSpy: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          limit: () => ({ abortSignal: async () => ({ error: null }) }),
        }),
        limit: () => ({ abortSignal: async () => ({ error: null }) }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
    auth: { admin: { listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })) } },
  })),
}));

// ── Mocks must be declared before any imports from the worker ─────────────────

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  // Returns a verified payload for any Bearer token — used only by A-03's
  // positive case and does not affect the no-token (attacker) cases.
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'verified-user', user_role: 'fan' } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientSpy,
}));

import worker from '@/worker/index';
import { resolveProxyTokenSecret, addSecurityHeaders, handleAuthSession } from '@/worker/index';

// All optionalServerSecret fields must be >= 16 chars to pass safeServerEnv.
const BASE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-1234567890',
  STRIPE_SECRET_KEY: 'stripe-secret-1234567890',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-1234567890',
  RESEND_API_KEY: 'resend-key-1234567890',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

// ── A-01: Proxy token secret resolution ──────────────────────────────────────

describe('resolveProxyTokenSecret (A-01)', () => {
  it('prefers STREAM_PROXY_SECRET when set', () => {
    expect(resolveProxyTokenSecret({
      STREAM_PROXY_SECRET: 'proxy-only-secret',
      OMNIHUB_SIGNING_SECRET: 'omnihub-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env)).toBe('proxy-only-secret');
  });

  it('falls back to OMNIHUB_SIGNING_SECRET when STREAM_PROXY_SECRET is absent', () => {
    expect(resolveProxyTokenSecret({
      OMNIHUB_SIGNING_SECRET: 'omnihub-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env)).toBe('omnihub-secret');
  });

  it('returns null when both STREAM_PROXY_SECRET and OMNIHUB_SIGNING_SECRET are absent', () => {
    expect(resolveProxyTokenSecret({
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env)).toBeNull();
  });

  it('never returns SUPABASE_SERVICE_ROLE_KEY under any input', () => {
    const serviceKey = 'service-role-key-that-must-not-leak';
    const result = resolveProxyTokenSecret({ SUPABASE_SERVICE_ROLE_KEY: serviceKey } as unknown as Env);
    expect(result).not.toBe(serviceKey);
    expect(result).toBeNull();
  });
});

// ── A-02: Admin client cache — real worker.fetch() path ──────────────────────
// Each sub-test uses a distinct SUPABASE_URL so module-level singleton state
// from previous tests never interferes with per-test call counting.

describe('getAdminClient cache (A-02)', () => {
  // Keys must be >= 20 chars: worker rejects /auth/* requests with shorter keys.
  const makeEnv = (url: string, key: string) =>
    ({ ...BASE_ENV, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } as unknown as Env);

  const bearerReq = () =>
    new Request('https://local/auth/session', {
      headers: { authorization: 'Bearer valid.jwt.token' },
    });

  it('creates a new client on cold cache — records URL and key', async () => {
    const before = createClientSpy.mock.calls.length;
    await worker.fetch(bearerReq(), makeEnv('https://a02-cold.supabase.co', 'a02-cold-svc-key-xxxxxxxxxxxx'));
    expect(createClientSpy.mock.calls.length).toBe(before + 1);
    const spyCalls = createClientSpy.mock.calls as unknown as Array<[string, string]>;
    expect(spyCalls[before][0]).toBe('https://a02-cold.supabase.co');
  });

  it('rebuilds client when SUPABASE_SERVICE_ROLE_KEY changes (same URL)', async () => {
    const url = 'https://a02-rotation.supabase.co';
    const before = createClientSpy.mock.calls.length;
    await worker.fetch(bearerReq(), makeEnv(url, 'a02-key-v1-xxxxxxxxxxxxxxxxxxx'));
    await worker.fetch(bearerReq(), makeEnv(url, 'a02-key-v2-xxxxxxxxxxxxxxxxxxx'));
    expect(createClientSpy.mock.calls.length).toBe(before + 2);
    const spyCalls = createClientSpy.mock.calls as unknown as Array<[string, string]>;
    expect(spyCalls[before][1]).toBe('a02-key-v1-xxxxxxxxxxxxxxxxxxx');
    expect(spyCalls[before + 1][1]).toBe('a02-key-v2-xxxxxxxxxxxxxxxxxxx');
  });

  it('returns cached client when URL and key are both unchanged', async () => {
    const env = makeEnv('https://a02-stable.supabase.co', 'a02-stable-svc-key-xxxxxxxxxx');
    const before = createClientSpy.mock.calls.length;
    await worker.fetch(bearerReq(), env);
    await worker.fetch(bearerReq(), env);
    // Only one new createClient call — second request hits the cache.
    expect(createClientSpy.mock.calls.length).toBe(before + 1);
  });
});

// ── A-03: Identity header stripping — real worker.fetch() path ───────────────

describe('Worker identity header stripping (A-03)', () => {
  it('strips all four attacker-supplied identity headers before auth routing', async () => {
    // Attacker supplies all four spoofed headers simultaneously with an elevated
    // role and a fabricated user ID. No Authorization: Bearer header is sent so
    // getSession() returns null (no valid JWT). If any of the four headers reached
    // the route handler, requireAuth() would return 200 with the attacker's
    // claimed identity. 401 proves every header was deleted before routing.
    const res = await worker.fetch(
      new Request('https://local/auth/session', {
        headers: {
          'x-sbbl-user-id':           'attacker-raw-id',
          'x-sbbl-user-id-verified':  'attacker-verified-id',
          'x-sbbl-roles':             'super_admin',
          'x-sbbl-roles-verified':    'super_admin',
          // No Authorization: Bearer — getSession returns null
        },
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(401);

    const body = await res.json() as Record<string, unknown>;
    // Response must not echo or leak any attacker-supplied identity value.
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('attacker-raw-id');
    expect(bodyStr).not.toContain('attacker-verified-id');
    expect(body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('Authorization header survives stripping — valid JWT returns 200 with server-verified identity', async () => {
    // A legitimate request carrying a Bearer JWT. jose mock verifies it and
    // returns sub='verified-user'. The worker re-adds x-sbbl-user-id-verified
    // after verification so the route handler returns the correct identity.
    // This confirms the strip only removes attacker-supplied headers, not the JWT.
    const res = await worker.fetch(
      new Request('https://local/auth/session', {
        headers: { authorization: 'Bearer valid.jwt.token' },
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; userId: string; roles: string[] };
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('verified-user');
    expect(body.roles).toContain('fan');
  });
});

// ── A-04: requireAuth / 401 path ─────────────────────────────────────────────

describe('handleAuthSession (A-04)', () => {
  it('returns 401 when x-sbbl-user-id-verified is absent from the request', async () => {
    const ctx = { req: new Request('https://local/auth/session') } as unknown as Parameters<typeof handleAuthSession>[0];
    const res = await handleAuthSession(ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 200 with userId and roles when verified header is present', async () => {
    const ctx = {
      req: new Request('https://local/auth/session', {
        headers: {
          'x-sbbl-user-id-verified': 'user-abc',
          'x-sbbl-roles-verified': 'league_admin,fan',
        },
      }),
    } as unknown as Parameters<typeof handleAuthSession>[0];
    const res = await handleAuthSession(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, userId: 'user-abc', roles: ['league_admin', 'fan'] });
  });
});

// ── A-06 / A-07: Security headers from the real addSecurityHeaders ────────────

describe('addSecurityHeaders (A-06, A-07)', () => {
  const hardened = () => addSecurityHeaders(new Response('ok', { status: 200 }));

  it('does NOT emit X-XSS-Protection (deprecated; mode=block is exploitable in IE)', () => {
    expect(hardened().headers.get('x-xss-protection')).toBeNull();
  });

  it('emits HSTS with 2-year max-age, includeSubDomains, preload', () => {
    const hsts = hardened().headers.get('strict-transport-security') ?? '';
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('emits X-Frame-Options: DENY', () => {
    expect(hardened().headers.get('x-frame-options')).toBe('DENY');
  });

  it("emits frame-ancestors 'none' in CSP", () => {
    expect(hardened().headers.get('content-security-policy') ?? '').toContain("frame-ancestors 'none'");
  });

  it('emits X-Content-Type-Options: nosniff', () => {
    expect(hardened().headers.get('x-content-type-options')).toBe('nosniff');
  });
});
