import { describe, expect, it } from 'vitest';
import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('worker route smoke', () => {
  it('returns auth failure without user header', async () => {
    const res = await worker.fetch(new Request('https://local/auth/session'), env);
    expect(res.status).toBe(401);
  });

  it('requires idempotency header for mutation routes', async () => {
    const res = await worker.fetch(new Request('https://local/api/orders', {
      method: 'POST',
      headers: { 'x-sbbl-user-id': 'u1' },
    }), env);

    expect(res.status).toBe(400);
  });

  it('returns public config without auth', async () => {
    const res = await worker.fetch(new Request('https://local/api/public-config'), env);
    expect(res.status).toBe(200);
    // supabaseUrl is intentionally NOT returned by this endpoint (security fix #3).
    // The endpoint exposes only non-sensitive app metadata.
    const data = await res.json() as { ok: boolean; supabaseUrl?: string; appName: string };
    expect(data.ok).toBe(true);
    expect(data.supabaseUrl).toBeUndefined();
    expect(data.appName).toBe('SBBL HQ');
  });
});
