import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'user-1', user_role: 'fan' } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        limit: () => ({
          abortSignal: async () => ({ error: null }),
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
      if (fn === 'get_stats_dashboard' || fn === 'get_leaderboards') {
        return { data: [{ id: 'p1' }], error: null };
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

  it('sets private no-store caching headers on authenticated stats endpoints', async () => {
    const authHeaders = { authorization: 'Bearer token' };

    const statsRes = await worker.fetch(new Request('https://local/api/stats', { headers: authHeaders }), env);
    expect(statsRes.status).toBe(200);
    expect(statsRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(statsRes.headers.get('Vary')).toContain('Authorization');

    const leaderboardsRes = await worker.fetch(new Request('https://local/api/leaderboards', { headers: authHeaders }), env);
    expect(leaderboardsRes.status).toBe(200);
    expect(leaderboardsRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(leaderboardsRes.headers.get('Vary')).toContain('Authorization');
  });
});
