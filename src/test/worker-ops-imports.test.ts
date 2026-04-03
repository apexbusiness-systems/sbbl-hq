
if (typeof globalThis.caches === 'undefined') {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => undefined,
    }
  } as any;
}
import { describe, expect, it } from 'vitest';
import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
} as unknown as Env;

describe('ops import routes auth', () => {
  it('rejects import mutation without auth', async () => {
    const res = await worker.fetch(new Request('https://local/ops/imports/teams', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'idempotency-key-1234' },
      body: JSON.stringify({ rows: [{ name: 'Test' }] }),
    }), env);

    expect(res.status).toBe(401);
  });
});
