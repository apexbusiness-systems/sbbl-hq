import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const insert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('no-session') }) },
    rpc,
    from: () => ({ insert }),
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
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
    rpc.mockResolvedValue({ data: [{ id: 'outbox-1', event_type: 'schedule_updated', entity_type: 'schedule', payload: {} }], error: null });
    insert.mockResolvedValue({ error: null });
  });

  it('blocks blocked-risk ingress envelopes', async () => {
    const res = await worker.fetch(new Request('https://local/api/ingress', {
      method: 'POST',
      headers: {
        'x-sbbl-user-id': 'u1',
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
