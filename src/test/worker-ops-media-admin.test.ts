import { describe, expect, it } from 'vitest';
import worker from '@/worker/index';

// These tests pin the auth shape of the media editor admin routes so we
// cannot accidentally expose the publications table to unauthenticated
// or non-super-admin callers. Public media rendering must continue to
// read through /api/public/media (status=published only) — these routes
// are the *only* admin path for mutating publications.

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
} as unknown as Env;

describe('ops media editor admin routes auth', () => {
  it('rejects GET /ops/list/media without auth', async () => {
    const res = await worker.fetch(
      new Request('https://local/ops/list/media'),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('rejects PATCH /ops/media/publications/:id without auth', async () => {
    const res = await worker.fetch(
      new Request('https://local/ops/media/publications/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        headers: {
          'x-idempotency-key': 'ops-media-patch-test-key-1234',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'renamed' }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('rejects DELETE /ops/media/publications/:id without auth', async () => {
    const res = await worker.fetch(
      new Request('https://local/ops/media/publications/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE',
        headers: { 'x-idempotency-key': 'ops-media-delete-test-key-1234' },
      }),
      env,
    );
    expect(res.status).toBe(401);
  });
});
