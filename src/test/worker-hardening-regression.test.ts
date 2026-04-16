import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'user-1', user_role: 'fan' } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    // The worker chains .from('profiles').select().eq().maybeSingle() when
    // computing stat-access tier for players, and .from('X').select().limit()
    // .abortSignal() for the env readiness check. Mock both surfaces.
    from: (_table: string) => ({
      select: () => ({
        limit: () => ({
          abortSignal: async () => ({ error: null }),
        }),
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    rpc,
    auth: { admin: { listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })) } },
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-1234567890',
  STRIPE_SECRET_KEY: 'stripe-secret-1234567890',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-1234567890',
  RESEND_API_KEY: 'resend-key-1234567890',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('worker hardening regressions', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (fn: string) => {
      // Handlers call get_stats_dashboard for both /api/stats and
      // /api/leaderboards (see docs/protocols/stats-tier-gating.md). The RPC
      // emits { ok, players: [...] }.
      if (fn === 'get_stats_dashboard' || fn === 'get_leaderboards') {
        return { data: { ok: true, players: [] }, error: null };
      }
      return { data: null, error: null };
    });
  });

  it('returns 413 for oversized webhook payloads', async () => {
    const body = 'x'.repeat(5 * 1024 * 1024 + 1);
    const res = await worker.fetch(
      new Request('https://local/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 't=1,v1=fake',
          'content-length': String(body.length),
        },
        body,
      }),
      env,
    );

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: 'payload_too_large',
      maxBytes: 5 * 1024 * 1024,
    });
  });

  // Stats is accessible to every tier — fans get a minimal stat line, paid
  // players and privileged roles get the full stat line. Leaderboards is
  // gated strictly to the 'full' tier (see handleLeaderboards).
  it('/api/stats returns private cache headers with a tier payload for authenticated callers', async () => {
    const authHeaders = { authorization: 'Bearer token' };

    const statsRes = await worker.fetch(new Request('https://local/api/stats', { headers: authHeaders }), env);
    expect(statsRes.status).toBe(200);
    expect(statsRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(statsRes.headers.get('Vary')).toContain('Authorization');

    const body = await statsRes.json();
    // Fan role is never granted full tier — the response must be minimal.
    expect(body.tier).toBe('minimal');
  });

  it('/api/leaderboards 403s for non-privileged authenticated callers (fan)', async () => {
    const authHeaders = { authorization: 'Bearer token' };

    const leaderboardsRes = await worker.fetch(new Request('https://local/api/leaderboards', { headers: authHeaders }), env);
    expect(leaderboardsRes.status).toBe(403);
    const body = await leaderboardsRes.json();
    expect(body).toMatchObject({ ok: false, error: 'forbidden' });
  });
});
