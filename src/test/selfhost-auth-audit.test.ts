/**
 * Auth flow audit tests — self-hosted Supabase.
 *
 * Covers the security invariants identified during the 2026-05-18 audit.
 * All assertions run against the real production code paths — no mirrored
 * helper duplicates.
 *
 *   A-01  Proxy token secret never falls back to SUPABASE_SERVICE_ROLE_KEY
 *   A-02  Admin client cache invalidates on service-role key rotation
 *   A-03  Worker strips client-supplied identity/role headers before routing
 *   A-04  requireAuth throws 'unauthorized' (→ 401) on missing verified header
 *   A-06  X-XSS-Protection header is NOT emitted (deprecated, exploitable in IE)
 *   A-07  HSTS / X-Frame-Options / CSP frame-ancestors are present and correct
 *
 * A-05 (PKCE config) is fully covered by supabase-client-pkce.test.ts which
 * mocks @supabase/supabase-js and asserts on the exact createClient options.
 * It is not duplicated here.
 */

import { describe, expect, it, vi } from 'vitest';

// ── jose + supabase mocks (required for any test that calls worker.fetch) ────
// jose is mocked so JWKS fetches never hit the network.  When a request carries
// no Authorization header, getBearerToken() returns null and getSession() bails
// before jwtVerify — so the mock is only needed for requests that DO send a
// token, but it is safer to mock unconditionally.
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'verified-user', user_role: 'fan' } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => ({
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
  }),
}));

import worker from '@/worker/index';
import { resolveProxyTokenSecret, addSecurityHeaders } from '@/worker/index';
import { makeAdminClientTracker } from '@/test/selfhost-auth-audit-helpers';
import { handleAuthSession } from '@/worker/index';

// safeServerEnv requires optionalServerSecret fields to be >= 16 chars when present.
const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-1234567890',
  STRIPE_SECRET_KEY: 'stripe-secret-1234567890',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-1234567890',
  RESEND_API_KEY: 'resend-key-1234567890',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

// ── A-01: Proxy token secret resolution ─────────────────────────────────────

describe('resolveProxyTokenSecret — real worker function (A-01)', () => {
  it('prefers STREAM_PROXY_SECRET when set', () => {
    const secret = resolveProxyTokenSecret({
      STREAM_PROXY_SECRET: 'proxy-only-secret',
      OMNIHUB_SIGNING_SECRET: 'omnihub-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env);
    expect(secret).toBe('proxy-only-secret');
  });

  it('falls back to OMNIHUB_SIGNING_SECRET when STREAM_PROXY_SECRET is absent', () => {
    const secret = resolveProxyTokenSecret({
      OMNIHUB_SIGNING_SECRET: 'omnihub-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env);
    expect(secret).toBe('omnihub-secret');
  });

  it('returns null when both STREAM_PROXY_SECRET and OMNIHUB_SIGNING_SECRET are absent', () => {
    const secret = resolveProxyTokenSecret({
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    } as unknown as Env);
    expect(secret).toBeNull();
  });

  it('never returns SUPABASE_SERVICE_ROLE_KEY under any input combination', () => {
    const serviceKey = 'service-role-key-that-must-not-leak';
    const secret = resolveProxyTokenSecret({ SUPABASE_SERVICE_ROLE_KEY: serviceKey } as unknown as Env);
    expect(secret).not.toBe(serviceKey);
    expect(secret).toBeNull();
  });
});

// ── A-02: Admin client cache invalidation on key rotation ───────────────────

describe('getAdminClient cache logic (A-02)', () => {
  it('rebuilds the client when SUPABASE_SERVICE_ROLE_KEY changes (same URL)', () => {
    const tracker = makeAdminClientTracker();
    const clientA = tracker.get({ SUPABASE_URL: 'https://db.example.com', SUPABASE_SERVICE_ROLE_KEY: 'key-v1' });
    const clientB = tracker.get({ SUPABASE_URL: 'https://db.example.com', SUPABASE_SERVICE_ROLE_KEY: 'key-v2' });
    expect(clientB).not.toBe(clientA);
    expect(tracker.createCount).toBe(2);
  });

  it('returns the cached client when both URL and key are unchanged', () => {
    const tracker = makeAdminClientTracker();
    const env = { SUPABASE_URL: 'https://db.example.com', SUPABASE_SERVICE_ROLE_KEY: 'key-stable' };
    const clientA = tracker.get(env);
    const clientB = tracker.get(env);
    expect(clientB).toBe(clientA);
    expect(tracker.createCount).toBe(1);
  });

  it('rebuilds the client when SUPABASE_URL changes (key unchanged)', () => {
    const tracker = makeAdminClientTracker();
    const clientA = tracker.get({ SUPABASE_URL: 'https://db-a.example.com', SUPABASE_SERVICE_ROLE_KEY: 'key-1' });
    const clientB = tracker.get({ SUPABASE_URL: 'https://db-b.example.com', SUPABASE_SERVICE_ROLE_KEY: 'key-1' });
    expect(clientB).not.toBe(clientA);
    expect(tracker.createCount).toBe(2);
  });
});

// ── A-03: Identity header stripping — integration via worker.fetch ───────────

describe('Worker identity header stripping (A-03)', () => {
  it('strips attacker-supplied x-sbbl-user-id-verified before auth routing', async () => {
    // An attacker injects a pre-verified identity header and an elevated role,
    // but sends NO valid Bearer JWT.
    // If the header were NOT stripped, requireAuth() would see the injected
    // value and return 200 with the attacker's claimed identity.
    // 401 proves the header was deleted before the route handler ran.
    const res = await worker.fetch(
      new Request('https://local/auth/session', {
        headers: {
          'x-sbbl-user-id-verified': 'attacker-injected-id',
          'x-sbbl-roles-verified': 'super_admin',
          // Deliberately no Authorization: Bearer header
        },
      }),
      baseEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('also strips x-sbbl-user-id (legacy unverified variant)', async () => {
    const res = await worker.fetch(
      new Request('https://local/auth/session', {
        headers: {
          'x-sbbl-user-id': 'legacy-attacker-id',
          'x-sbbl-roles': 'super_admin',
        },
      }),
      baseEnv,
    );
    expect(res.status).toBe(401);
  });

  it('Authorization header survives stripping (JWT path still works)', async () => {
    // A legitimate JWT request — jose mock verifies successfully, so
    // getSession() returns { userId: 'verified-user', roles: ['fan'] }.
    // The route should see the verified header and respond 200.
    const res = await worker.fetch(
      new Request('https://local/auth/session', {
        headers: { authorization: 'Bearer valid.jwt.token' },
      }),
      baseEnv,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; userId: string };
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('verified-user');
  });
});

// ── A-04: requireAuth / unauthorized path ────────────────────────────────────

describe('handleAuthSession unauthorized (A-04)', () => {
  it('returns 401 when x-sbbl-user-id-verified is absent', async () => {
    const req = new Request('https://local/auth/session');
    const ctx = { req } as unknown as Parameters<typeof handleAuthSession>[0];
    const res = await handleAuthSession(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 200 with userId and roles when verified header is present', async () => {
    const req = new Request('https://local/auth/session', {
      headers: {
        'x-sbbl-user-id-verified': 'user-abc',
        'x-sbbl-roles-verified': 'league_admin,fan',
      },
    });
    const ctx = { req } as unknown as Parameters<typeof handleAuthSession>[0];
    const res = await handleAuthSession(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, userId: 'user-abc', roles: ['league_admin', 'fan'] });
  });
});

// ── A-06 / A-07: Security headers — real addSecurityHeaders function ─────────

describe('Security headers — real addSecurityHeaders (A-06, A-07)', () => {
  it('does NOT emit X-XSS-Protection (deprecated, IE attack surface)', () => {
    const hardened = addSecurityHeaders(new Response('ok', { status: 200 }));
    expect(hardened.headers.get('x-xss-protection')).toBeNull();
  });

  it('emits HSTS with 2-year max-age, includeSubDomains, and preload', () => {
    const hardened = addSecurityHeaders(new Response('ok', { status: 200 }));
    const hsts = hardened.headers.get('strict-transport-security');
    expect(hsts).toBeTruthy();
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('emits X-Frame-Options: DENY', () => {
    const hardened = addSecurityHeaders(new Response('ok', { status: 200 }));
    expect(hardened.headers.get('x-frame-options')).toBe('DENY');
  });

  it('emits frame-ancestors: none in CSP (belt-and-suspenders with X-Frame-Options)', () => {
    const hardened = addSecurityHeaders(new Response('ok', { status: 200 }));
    const csp = hardened.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('emits X-Content-Type-Options: nosniff', () => {
    const hardened = addSecurityHeaders(new Response('ok', { status: 200 }));
    expect(hardened.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
