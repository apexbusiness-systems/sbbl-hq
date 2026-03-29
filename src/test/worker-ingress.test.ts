import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const insert = vi.fn();
const getUser = vi.fn();

// Mock Supabase: getUser returns a valid user when a Bearer token is present,
// simulating a successfully verified JWT session.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
    from: () => ({ insert }),
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  OMNIHUB_SIGNING_SECRET: 'omnihub-signing-secret-12345',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('worker omniport ingress routes', () => {
  beforeEach(() => {
    rpc.mockReset();
    insert.mockReset();
    getUser.mockReset();
    // Authenticated user so requireAuth passes — we reach the 403 blocked-risk path
    getUser.mockResolvedValue({ data: { user: { id: 'user-test-001' } }, error: null });
    rpc.mockResolvedValue({ data: null, error: null });
    insert.mockResolvedValue({ error: null });
  });

  it('blocks blocked-risk ingress envelopes', async () => {
    // Must supply a valid Bearer token — x-sbbl-user-id header is stripped
    // as part of security hardening (fix #2). Session now requires JWT only.
    const res = await worker.fetch(new Request('https://local/api/ingress', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer test-token-001',
        'x-idempotency-key': 'idempotency-key-002',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source_type: 'admin_mutation',
        entity_type: 'ops',
        payload: { statement: 'DROP TABLE billing_events' },
      }),
    }), env);

    expect(res.status).toBe(403);
  });
});
