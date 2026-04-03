
import { expect, describe, it, vi, beforeEach } from 'vitest';
import worker from '@/worker/index';
import * as jose from 'jose';

globalThis.fetch = async (req: any) => {
  return new Response(JSON.stringify({ keys: [] }), { status: 200 });
};

globalThis.caches = {
  default: {
    match: async () => undefined,
    put: async () => undefined,
  }
} as any;

const rpc = vi.fn();
const insert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-test-uuid-001' } },
        error: null,
      }),
    },
    rpc,
    from: () => ({ insert }),
  }),
}));

vi.mock('jose', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: {
        sub: 'user-test-uuid-001',
        app_metadata: { roles: ['fan'] }
      }
    })
  };
});

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
    rpc.mockResolvedValue({ data: [{ id: 'outbox-1', event_type: 'schedule_updated', entity_type: 'schedule', payload: {} }], error: null });
    insert.mockResolvedValue({ error: null });
  });

  it('blocks blocked-risk ingress envelopes', async () => {
    const res = await worker.fetch(new Request('https://local/api/ingress', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer valid-test-jwt-token',
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
