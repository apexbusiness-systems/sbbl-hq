import { describe, expect, it, vi, beforeEach } from 'vitest';

const updatedRows: Array<Record<string, unknown>> = [];
const deletedRows: Array<string> = [];
const auditRows: Array<Record<string, unknown>> = [];

const from = vi.fn((table: string) => {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn((patch: Record<string, unknown>) => ({
      eq: vi.fn().mockImplementation(() => {
        if (table === 'teams') updatedRows.push({ table, patch });
        return Promise.resolve({ error: null });
      }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockImplementation((col: string, val: string) => {
        deletedRows.push(`${table}:${col}:${val}`);
        return Promise.resolve({ error: null });
      }),
    })),
    insert: vi.fn((payload: Record<string, unknown>) => {
      if (table === 'audit_logs') auditRows.push(payload);
      return Promise.resolve({ error: null });
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-uuid-001' } }, error: null }),
    },
    from,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// Mock requireAdminSession to return admin session for test purposes
vi.mock('@/lib/auth/roles', () => ({
  canAccessOps: vi.fn().mockReturnValue(true),
  hasRole: vi.fn().mockReturnValue(true),
  assertRole: vi.fn(),
  APP_ROLES: ['fan', 'player', 'league_admin', 'super_admin'],
}));

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

function adminRequest(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      'authorization': 'Bearer valid-test-jwt-token',
      'x-idempotency-key': `idem-${crypto.randomUUID()}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('ops entity CRUD routes', () => {
  beforeEach(() => {
    updatedRows.length = 0;
    deletedRows.length = 0;
    auditRows.length = 0;
    from.mockClear();
  });

  it('PATCH /ops/teams/:id rejects unauthenticated requests', async () => {
    const res = await worker.fetch(new Request('https://local/ops/teams/team-123', {
      method: 'PATCH',
      headers: { 'x-idempotency-key': 'idem-test-1', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    }), env);
    expect(res.status).toBe(400);
  });

  it('DELETE /ops/teams/:id requires idempotency key', async () => {
    const res = await worker.fetch(new Request('https://local/ops/teams/team-123', {
      method: 'DELETE',
      headers: { 'authorization': 'Bearer valid-test-jwt-token', 'content-type': 'application/json' },
    }), env);
    expect(res.status).toBe(400);
  });

  it('GET /api/public/schedule returns ok shape', async () => {
    const res = await worker.fetch(new Request('https://local/api/public/schedule'), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; days: unknown[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.days)).toBe(true);
  });

  it('GET /api/public/potg returns ok shape', async () => {
    const res = await worker.fetch(new Request('https://local/api/public/potg'), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; data: unknown[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
