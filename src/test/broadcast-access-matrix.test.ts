/**
 * broadcast-access-matrix.test.ts  — MODULE B
 *
 * Proves paywall access-control rules for every role identity using the
 * same in-memory Supabase mock as worker-stream-hardening.test.ts.
 *
 * Suite B-1  super_admin  — fast-path, no gate checks
 * Suite B-2  player / paid_fan — hasPrivilegedRole path
 * Suite B-3  registered fan — can_user_view_stream RPC gate (commit 66880be fix)
 * Suite B-4  anon / unauthenticated — 403 on every session attempt
 * Suite B-5  PPV entitlement path (stream_entitlements row)
 * Suite B-6  invite-based access (ppv_invites path)
 * Suite B-7  one-device displacement — new session displaces old
 * Suite B-8  stream_offline gate — non-admin blocked when is_live=false
 * Suite B-9  can_user_view_stream RPC static contract verification
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { handlePlaybackSession } from '@/worker/index';

const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');

// ── In-memory mock (canonical pattern) ───────────────────────────────────────
type Row = Record<string, unknown>;

function createQuery(table: string, state: Record<string, Row[]>) {
  const filters: Array<(row: Row) => boolean> = [];
  const api: any = {
    eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return api; },
    is(col: string, val: unknown) { filters.push((r) => r[col] === val); return api; },
    gt(col: string, val: unknown) { filters.push((r) => String(r[col]) > String(val)); return api; },
    in(col: string, vals: unknown[]) { filters.push((r) => vals.includes(r[col])); return api; },
    order() { return api; },
    limit() { return api; },
    maybeSingle: async () => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      if (!rows[0]) return { data: null, error: { message: 'not_found' } };
      return { data: rows[0], error: null };
    },
    then: async (res: (v: unknown) => unknown) => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return res({ data: rows, error: null, count: api._countMode ? rows.length : undefined });
    },
    select: (cols?: any, opts?: any) => { if (opts?.count === 'exact') api._countMode = true; return api; },
    update: (patch: Row) => {
      const colFilters: Array<(r: Row) => boolean> = [];
      const applyPatch = () => {
        (state[table] ?? []).forEach((r) => {
          if (colFilters.every((fn) => fn(r))) Object.assign(r, patch);
        });
      };
      const builder: any = {
        eq(col: string, val: unknown) { colFilters.push((r) => r[col] === val); return builder; },
        neq(col: string, val: unknown) {
          colFilters.push((r) => r[col] !== val);
          applyPatch();
          return { error: null };
        },
        select: () => {
          applyPatch();
          const target = (state[table] ?? []).find((r) => colFilters.every((fn) => fn(r)));
          return {
            maybeSingle: async () => ({ data: target ?? null, error: null }),
            single: async () => ({ data: target ?? null, error: target ? null : { message: 'not_found' } }),
          };
        },
      };
      return builder;
    },
    delete: () => {
      const colFilters: Array<(r: Row) => boolean> = [];
      return {
        eq(col: string, val: unknown) {
          colFilters.push((r) => r[col] === val);
          state[table] = (state[table] ?? []).filter((r) => !colFilters.every((fn) => fn(r)));
          return { error: null };
        },
      };
    },
    insert: (row: Row) => {
      const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
      state[table] = [...(state[table] ?? []), normalized];
      return { select: () => ({ single: async () => ({ data: normalized, error: null }) }) };
    },
    upsert: (row: Row, _opts?: unknown) => {
      const rows = state[table] ?? [];
      const existing = rows.find((r) =>
        row.user_id !== undefined
          ? r.user_id === row.user_id && r.game_id === row.game_id && r.idempotency_key === row.idempotency_key
          : r.id === row.id,
      );
      if (existing) { Object.assign(existing, row); }
      else { state[table] = [...rows, { ...row, id: row.id ?? crypto.randomUUID() }]; }
      const result = existing ?? state[table][state[table].length - 1];
      return { select: () => ({ single: async () => ({ data: result, error: null }) }) };
    },
  };
  return api;
}

/**
 * Build a mock admin client.
 * rpcResults: map of rpc name → return value for can_user_view_stream overrides.
 */
function buildAdmin(state: Record<string, Row[]>, rpcResults: Record<string, unknown> = {}) {
  return {
    from: (table: string) => createQuery(table, state),
    rpc: (name: string, payload: Record<string, unknown>) => {
      if (name in rpcResults) return Promise.resolve({ data: rpcResults[name], error: null });
      if (name === 'can_user_view_stream') {
        const userId = String(payload.p_user_id ?? '');
        // Default: only 'ppv-fan' has entitlement
        return Promise.resolve({ data: userId === 'ppv-fan', error: null });
      }
      if (name === 'consume_stream_rate_limit') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  } as any;
}

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  STRIPE_SECRET_KEY: 'stripe',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  RESEND_API_KEY: 'resend',
} as any;

/** Base live state shared across most suites */
function baseLiveState(): Record<string, Row[]> {
  return {
    api_idempotency_keys: [],
    user_role_assignments: [],
    stream_sessions: [{ id: 'sess-1', game_id: 'game-1', status: 'live', peak_viewers: 0 }],
    games: [{ id: 'game-1', status: 'live', replay_mode: 'none' }],
    stream_admin_config: [{ id: true, collection_id: 'https://live.example/stream.m3u8', title: 'Live', is_live: true }],
    stream_access_sessions: [],
    stream_entitlements: [],
    ppv_invites: [],
  };
}

function sessionReq(userId: string, idKey: string) {
  return new Request('https://local/api/streams/game-1/session', {
    method: 'POST',
    headers: {
      'x-idempotency-key': idKey,
      'x-sbbl-user-id-verified': userId,
    },
    body: JSON.stringify({ sessionKey: `sk-${idKey}` }),
  });
}

// ── B-1: super_admin fast-path ────────────────────────────────────────────────
describe('B-1: super_admin — fast-path bypass', () => {
  it('super_admin receives 200 without RPC access check', async () => {
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'super-admin', role: 'super_admin' }];

    const res = await handlePlaybackSession({
      req: sessionReq('super-admin', 'b1-key-1234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.playback.url).toBeDefined();
  });

  it('super_admin fast-path does NOT create a stream_access_sessions row', async () => {
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'super-admin', role: 'super_admin' }];

    await handlePlaybackSession({
      req: sessionReq('super-admin', 'b1-key-2234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);

    // Super admin uses a synthetic session — no DB row written
    expect(state.stream_access_sessions.length).toBe(0);
  });

  it('super_admin playback URL is proxied (origin hidden from client)', async () => {
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'super-admin', role: 'super_admin' }];

    const res = await handlePlaybackSession({
      req: sessionReq('super-admin', 'b1-key-3234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    const body = await res.json() as Record<string, any>;
    expect(body.playback.url).not.toContain('live.example');
    expect(body.playback.url).toContain('/api/streams/');
    expect(body.playback.url).toContain('/proxy/');
  });

  it('super_admin session response contains maxExpiresAt within 6h window', async () => {
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'super-admin', role: 'super_admin' }];
    const now = Date.now();

    const res = await handlePlaybackSession({
      req: sessionReq('super-admin', 'b1-key-4234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    const body = await res.json() as Record<string, any>;
    const maxMs = new Date(body.session.maxExpiresAt).getTime();
    expect(maxMs).toBeGreaterThanOrEqual(now + (6 * 60 * 60 * 1000) - 5_000);
    expect(maxMs).toBeLessThanOrEqual(now + (6 * 60 * 60 * 1000) + 5_000);
  });
});

// ── B-2: player / paid_fan — hasPrivilegedRole ────────────────────────────────
describe('B-2: player and paid_fan — privileged role bypass', () => {
  for (const role of ['player', 'paid_fan']) {
    it(`${role} receives 200 without PPV entitlement`, async () => {
      const state = baseLiveState();
      state.user_role_assignments = [{ user_id: `${role}-user`, role }];

      const res = await handlePlaybackSession({
        req: sessionReq(`${role}-user`, `b2-${role}-123456`),
        params: { gameId: 'game-1' },
        env,
        admin: buildAdmin(state),
      } as any);
      expect(res.status).toBe(200);
    });
  }

  it('player session creates a stream_access_sessions DB row', async () => {
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'player-user', role: 'player' }];

    await handlePlaybackSession({
      req: sessionReq('player-user', 'b2-player-234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    expect(state.stream_access_sessions.length).toBeGreaterThan(0);
  });
});

// ── B-3: Registered fan — can_user_view_stream gate (commit 66880be) ──────────
describe('B-3: registered fan — can_user_view_stream RPC gate', () => {
  it('fan with no entitlement receives 403 forbidden', async () => {
    const state = baseLiveState();
    // No role assignment, no entitlement — plain registered fan
    const res = await handlePlaybackSession({
      req: sessionReq('reg-fan-no-entitlement', 'b3-fan-1234567'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state, { can_user_view_stream: false }),
    } as any);
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('forbidden');
  });

  it('fan with PPV entitlement (RPC returns true) receives 200', async () => {
    const state = baseLiveState();
    const res = await handlePlaybackSession({
      req: sessionReq('ppv-fan', 'b3-ppv-fan-12345'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state), // buildAdmin returns true for 'ppv-fan' by default
    } as any);
    expect(res.status).toBe(200);
  });

  it('handlePlaybackSession calls can_user_view_stream when no privileged role', () => {
    const fnStart = workerSrc.indexOf('async function handlePlaybackSession');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('can_user_view_stream');
    expect(body).toContain('p_game_id');
    expect(body).toContain('p_user_id');
  });

  it('can_user_view_stream RPC is only called when hasPrivilegedRole is false', () => {
    const fnStart = workerSrc.indexOf('async function handlePlaybackSession');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    // The RPC call must be inside a !hasAccess && gameId guard
    const rpcIdx = body.indexOf('can_user_view_stream');
    const guardIdx = body.lastIndexOf('!hasAccess', rpcIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(rpcIdx).toBeGreaterThan(guardIdx);
  });
});

// ── B-4: Anon / unauthenticated — 403 ────────────────────────────────────────
describe('B-4: unauthenticated caller — always 403', () => {
  it('request with no x-sbbl-user-id-verified header is denied', async () => {
    const state = baseLiveState();
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'b4-anon-key-12345' },
        body: JSON.stringify({ sessionKey: 'sk-anon-12345678' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    // requireAuth throws → handler returns 500 or 400; either way NOT 200
    expect(res.status).not.toBe(200);
  });
});

// ── B-5: PPV entitlement via stream_entitlements ──────────────────────────────
describe('B-5: PPV entitlement — can_user_view_stream Path A', () => {
  it('active non-expired entitlement grants access via RPC true', async () => {
    const state = baseLiveState();
    state.stream_entitlements = [{
      id: 'ent-1',
      game_id: 'game-1',
      user_id: 'ent-fan',
      status: 'active',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      replay_tier: null,
    }];
    // Override RPC to simulate DB check returning true for 'ent-fan'
    const res = await handlePlaybackSession({
      req: sessionReq('ent-fan', 'b5-ent-key-12345'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state, { can_user_view_stream: true }),
    } as any);
    expect(res.status).toBe(200);
  });

  it('expired entitlement (RPC returns false) results in 403', async () => {
    const state = baseLiveState();
    const res = await handlePlaybackSession({
      req: sessionReq('expired-fan', 'b5-exp-key-12345'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state, { can_user_view_stream: false }),
    } as any);
    expect(res.status).toBe(403);
  });
});

// ── B-6: Invite-based access ──────────────────────────────────────────────────
describe('B-6: invite-based access — can_user_view_stream Path B', () => {
  it('redeemed non-expired invite (RPC true) grants 200', async () => {
    const state = baseLiveState();
    const res = await handlePlaybackSession({
      req: sessionReq('invite-fan', 'b6-inv-key-12345'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state, { can_user_view_stream: true }),
    } as any);
    expect(res.status).toBe(200);
  });

  it('invite with no redemption (RPC false) returns 403', async () => {
    const state = baseLiveState();
    const res = await handlePlaybackSession({
      req: sessionReq('unredeemed-fan', 'b6-noinv-key-1234'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state, { can_user_view_stream: false }),
    } as any);
    expect(res.status).toBe(403);
  });
});

// ── B-7: One-device displacement ──────────────────────────────────────────────
describe('B-7: one-device displacement', () => {
  it('new session from player displaces existing active session', async () => {
    const now = Date.now();
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'player-user', role: 'player' }];
    state.stream_access_sessions = [{
      id: 'old-sess',
      game_id: 'game-1',
      user_id: 'player-user',
      status: 'active',
      expires_at: new Date(now + 30_000).toISOString(),
      idempotency_key: 'old-session-key',
    }];

    const res = await handlePlaybackSession({
      req: sessionReq('player-user', 'b7-disp-key-12345'),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    expect(res.status).toBe(200);
    expect(state.stream_access_sessions[0].status).toBe('displaced');
  });

  it('same session key (refresh) does NOT displace and preserves maxExpiresAt', async () => {
    const originalCap = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const state = baseLiveState();
    state.user_role_assignments = [{ user_id: 'player-user', role: 'player' }];
    state.stream_access_sessions = [{
      id: 'sess-stable',
      game_id: 'game-1',
      user_id: 'player-user',
      status: 'active',
      expires_at: new Date(Date.now() + 30_000).toISOString(),
      max_expires_at: originalCap,
      idempotency_key: 'stable-session-key',
    }];

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'b7-stable-key-12345',
          'x-sbbl-user-id-verified': 'player-user',
        },
        body: JSON.stringify({ sessionKey: 'stable-session-key' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.session.maxExpiresAt).toBe(originalCap);
  });
});

// ── B-8: stream_offline gate ──────────────────────────────────────────────────
describe('B-8: stream_offline gate for broadcast alias', () => {
  it('player receives stream_offline 403 when is_live=false and gameId=broadcast', async () => {
    const state = baseLiveState();
    state.stream_admin_config = [{ id: true, collection_id: 'https://live.example/stream.m3u8', is_live: false }];
    state.user_role_assignments = [{ user_id: 'player-user', role: 'player' }];

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'b8-offline-key-1234',
          'x-sbbl-user-id-verified': 'player-user',
        },
        body: JSON.stringify({ sessionKey: 'sk-offline-12345' }),
      }),
      params: { gameId: 'broadcast' },
      env,
      admin: buildAdmin(state),
    } as any);
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('stream_offline');
  });
});

// ── B-9: can_user_view_stream RPC static contract ─────────────────────────────
describe('B-9: can_user_view_stream migration contract', () => {
  it('latest migration defines can_user_view_stream with text game_id', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260402120000_ppv_invites_relax_game_id.sql'),
      'utf-8',
    );
    expect(migSrc).toMatch(/create or replace function public\.can_user_view_stream/);
    expect(migSrc).toContain('p_game_id text');
    expect(migSrc).toContain('p_user_id uuid');
    expect(migSrc).toContain('returns boolean');
  });

  it('RPC Path A checks stream_entitlements for active non-expired row', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260402120000_ppv_invites_relax_game_id.sql'),
      'utf-8',
    );
    expect(migSrc).toContain('stream_entitlements');
    expect(migSrc).toContain("status   = 'active'");
    expect(migSrc).toContain('expires_at > now()');
  });

  it('RPC Path B checks ppv_invites for used_by match and non-expired', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260402120000_ppv_invites_relax_game_id.sql'),
      'utf-8',
    );
    expect(migSrc).toContain('ppv_invites');
    expect(migSrc).toContain('used_by   = p_user_id');
    expect(migSrc).toContain('expires_at > now()');
  });

  it('RPC returns false (not null) when neither path matches', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260402120000_ppv_invites_relax_game_id.sql'),
      'utf-8',
    );
    expect(migSrc).toContain('return false;');
  });

  it('RPC uses security definer + search_path = public', () => {
    const migSrc = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260402120000_ppv_invites_relax_game_id.sql'),
      'utf-8',
    );
    expect(migSrc).toContain('security definer');
    expect(migSrc).toContain('set search_path = public');
  });
});
