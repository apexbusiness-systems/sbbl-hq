import { describe, expect, it, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

const db = {
  player_game_stats: [
    { id: 'pgs-1', game_id: 'game-1', player_id: 'player-1', pts: 24, reb: 7, ast: 5, stl: 2, blk: 1, fls: 2, min: 31 },
  ] as Row[],
  stream_entitlements: [
    { id: 'ent-1', game_id: 'game-1', user_id: 'user-1', status: 'active', expires_at: null, created_at: '2026-04-01T00:00:00Z' },
  ] as Row[],
  stream_sessions: [] as Row[],
  cart_items: [
    { id: 'item-1', cart_id: 'cart-1', carts: { user_id: 'user-1', status: 'open' } },
  ] as Row[],
  reward_catalog: [
    { id: 'reward-1', status: 'published', name: 'VIP Shirt', credit_cost: 10 },
  ] as Row[],
  reward_claims: [] as Row[],
};

function filteredTable(table: keyof typeof db) {
  let rows = [...db[table]];
  let deleting = false;
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn((col: string, val: unknown) => {
      if (deleting) {
        db[table] = db[table].filter((r) => r[col] !== val);
        rows = [];
        return api;
      }
      rows = rows.filter((r) => r[col] === val);
      return api;
    }),
    order: vi.fn(() => api),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    insert: vi.fn((payload: Row | Row[]) => {
      const list = Array.isArray(payload) ? payload : [payload];
      list.forEach((r) => {
        const row = { id: r.id ?? `${table}-${Math.random()}`, ...r };
        db[table].push(row);
        rows = [row];
      });
      return api;
    }),
    delete: vi.fn(() => {
      deleting = true;
      return api;
    }),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  return api;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: (table: string) => {
      if (table === 'api_idempotency_keys') {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      if (!(table in db)) throw new Error(`Unexpected table ${table}`);
      return filteredTable(table as keyof typeof db);
    },
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

const authHeaders = {
  authorization: 'Bearer test-token',
  'x-idempotency-key': 'idem-key-000001',
};

describe('worker persistence routes', () => {
  beforeEach(() => {
    db.stream_sessions.length = 0;
    db.reward_claims.length = 0;
    db.cart_items.splice(0, db.cart_items.length, { id: 'item-1', cart_id: 'cart-1', carts: { user_id: 'user-1', status: 'open' } });
  });

  it('returns stat-sheet rows from player_game_stats', async () => {
    const res = await worker.fetch(new Request('https://local/api/games/game-1/stat-sheet', { headers: authHeaders }), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; rows: Array<{ id: string }> };
    expect(data.ok).toBe(true);
    expect(data.rows[0]?.id).toBe('pgs-1');
  });

  it('creates stream session and redeems rewards with real persistence paths', async () => {
    const streamRes = await worker.fetch(new Request('https://local/api/streams/game-1/session', {
      method: 'POST',
      headers: authHeaders,
    }), env);
    expect(streamRes.status).toBe(200);

    const rewardRes = await worker.fetch(new Request('https://local/api/rewards/redeem', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json', 'x-idempotency-key': 'idem-key-000002' },
      body: JSON.stringify({ rewardId: 'reward-1' }),
    }), env);
    expect(rewardRes.status).toBe(200);

    const rewardData = await rewardRes.json() as { ok: boolean; claim: { reward_id: string } };
    expect(rewardData.ok).toBe(true);
    expect(rewardData.claim.reward_id).toBe('reward-1');
    expect(db.reward_claims.length).toBe(1);
  });

  it('deletes cart items through ownership-checked path', async () => {
    const res = await worker.fetch(new Request('https://local/api/cart/items/item-1', {
      method: 'DELETE',
      headers: { ...authHeaders, 'x-idempotency-key': 'idem-key-000003' },
    }), env);

    expect(res.status).toBe(200);
    expect(db.cart_items.length).toBe(0);
  });
});
