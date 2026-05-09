import { describe, expect, it, beforeEach, vi } from 'vitest';

const mediaUpdateCalls: Array<{ patch: Record<string, unknown>; id: string }> = [];
const auditInsertSpy = vi.fn();
const idempotencyInsertSpy = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'user_role_assignments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({ data: [{ role: 'super_admin' }], error: null }),
            ),
          })),
        };
      }

      if (table === 'api_idempotency_keys') {
        return {
          insert: idempotencyInsertSpy.mockImplementation(() =>
            Promise.resolve({ error: null }),
          ),
        };
      }

      if (table === 'media_publications') {
        return {
          update: vi.fn((patch: Record<string, unknown>) => ({
            eq: vi.fn((_: string, id: string) => {
              mediaUpdateCalls.push({ patch, id });
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === 'audit_logs') {
        return {
          insert: auditInsertSpy.mockImplementation(() =>
            Promise.resolve({ error: null }),
          ),
        };
      }

      return {
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
      };
    },
  }),
}));


vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'admin-user-1', user_role: 'super_admin' } })),
}));

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

function authedRequest(path: string, body: unknown) {
  return new Request(`https://local${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': 'ops-media-order-test-key-1234',
      authorization: 'Bearer test-jwt-token',
    },
    body: JSON.stringify(body),
  });
}

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

describe('POST /ops/media/publications/order', () => {
  beforeEach(() => {
    mediaUpdateCalls.length = 0;
    auditInsertSpy.mockClear();
    idempotencyInsertSpy.mockClear();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await worker.fetch(
      new Request('https://local/ops/media/publications/order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': 'ops-media-order-test-key-unauth',
        },
        body: JSON.stringify({ items: [{ id: 'pub-1', sortOrder: 0 }] }),
      }),
      env,
    );

    expect(res.status).toBe(401);
  });

  it('returns empty_items for an empty list', async () => {
    const res = await worker.fetch(
      authedRequest('/ops/media/publications/order', { items: [] }),
      env,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'empty_items' });
    expect(mediaUpdateCalls).toHaveLength(0);
  });

  it('returns duplicate_ids when IDs repeat', async () => {
    const res = await worker.fetch(
      authedRequest('/ops/media/publications/order', {
        items: [
          { id: 'pub-1', sortOrder: 0 },
          { id: 'pub-1', sortOrder: 1 },
        ],
      }),
      env,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'duplicate_ids' });
    expect(mediaUpdateCalls).toHaveLength(0);
  });

  it.each([
    { id: 'pub-1', sortOrder: 1.5 },
    { id: 'pub-1', sortOrder: -1 },
  ])('returns invalid_items for invalid sortOrder payload: %j', async (item) => {
    const res = await worker.fetch(
      authedRequest('/ops/media/publications/order', { items: [item] }),
      env,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'invalid_items' });
    expect(mediaUpdateCalls).toHaveLength(0);
  });

  it('returns success contract and calls admin layer updates', async () => {
    const res = await worker.fetch(
      authedRequest('/ops/media/publications/order', {
        items: [
          { id: 'pub-1', sortOrder: 2 },
          { id: 'pub-2', sortOrder: 0 },
        ],
      }),
      env,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, updated: 2 });

    expect(idempotencyInsertSpy).toHaveBeenCalledTimes(1);
    expect(mediaUpdateCalls).toEqual([
      { patch: { sort_order: 2 }, id: 'pub-1' },
      { patch: { sort_order: 0 }, id: 'pub-2' },
    ]);
    expect(auditInsertSpy).toHaveBeenCalledTimes(1);
  });
});
