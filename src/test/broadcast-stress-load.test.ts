/**
 * broadcast-stress-load.test.ts  — MODULE C/D
 *
 * Stress and concurrency simulation for the broadcast session pipeline.
 * Runs under the standard vitest runner (no external infra required).
 * Set STRESS=1 env var for extended iteration counts.
 *
 * Suite C-1  Concurrent session creation — zero duplicates at 50 VU
 * Suite C-2  One-device displacement under burst — old session always displaced
 * Suite C-3  Heartbeat storm — 200 concurrent heartbeats, all 200 or 404
 * Suite C-4  Rate limit self-heal — RPC fallback keeps handler alive
 * Suite C-5  Session expiry — expired sessions rejected by heartbeat
 * Suite C-6  Idempotency — same key 10× returns same result, no DB duplication
 * Suite C-7  Forbidden storm — 500 concurrent 403s, none leak 200
 * Suite C-8  Config bootstrap race — 20 concurrent status polls, all consistent
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  handlePlaybackSession,
  handleStreamSessionHeartbeat,
  handlePublicStreamStatus,
} from '@/worker/index';

const STRESS = Boolean(process.env.STRESS);
const VU = STRESS ? 200 : 50;   // virtual users
const ITER = STRESS ? 10 : 3;   // iterations per scenario

// ── Shared mock infrastructure ────────────────────────────────────────────────
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

function buildAdmin(state: Record<string, Row[]>, rpcOverride?: Record<string, unknown>) {
  return {
    from: (table: string) => createQuery(table, state),
    rpc: (name: string, payload: Record<string, unknown>) => {
      if (rpcOverride && name in rpcOverride)
        return Promise.resolve({ data: rpcOverride[name], error: null });
      if (name === 'can_user_view_stream')
        return Promise.resolve({ data: (payload.p_user_id as string)?.startsWith('allowed'), error: null });
      if (name === 'consume_stream_rate_limit')
        return Promise.resolve({ data: true, error: null });
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

function liveState(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    api_idempotency_keys: [],
    user_role_assignments: [],
    stream_sessions: [{ id: 'sess-1', game_id: 'game-1', status: 'live', peak_viewers: 0 }],
    games: [{ id: 'game-1', status: 'live', replay_mode: 'none' }],
    stream_admin_config: [{
      id: true,
      collection_id: 'https://live.sbbl-hq.icu/hls/stream.m3u8',
      title: 'WBL Live',
      is_live: true,
    }],
    stream_access_sessions: [],
    stream_entitlements: [],
    ppv_invites: [],
    ...extra,
  };
}

function stubCaches() {
  (globalThis as any).caches = {
    default: {
      match: async () => undefined,
      put: async () => undefined,
      delete: async () => undefined,
    },
  };
}

// ── C-1: Concurrent session creation — zero duplicates ────────────────────────
describe(`C-1: concurrent session creation — ${VU} virtual users`, () => {
  it('all VU sessions return 200 and produce distinct session IDs', async () => {
    const state = liveState();
    // Add player roles for all VUs
    for (let i = 0; i < VU; i++) {
      state.user_role_assignments.push({ user_id: `player-${i}`, role: 'player' });
    }
    const admin = buildAdmin(state);

    const results = await Promise.all(
      Array.from({ length: VU }, (_, i) =>
        handlePlaybackSession({
          req: new Request('https://local/api/streams/game-1/session', {
            method: 'POST',
            headers: {
              'x-idempotency-key': `c1-key-${i}-${Date.now()}`,
              'x-sbbl-user-id-verified': `player-${i}`,
            },
            body: JSON.stringify({ sessionKey: `sk-c1-${i}-${Date.now()}` }),
          }),
          params: { gameId: 'game-1' },
          env,
          admin,
        } as any),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.every((s) => s === 200)).toBe(true);

    // Each user gets a unique session
    const sessionBodies = await Promise.all(results.map((r) => r.json() as Promise<any>));
    const sessionIds = sessionBodies.map((b) => b.session?.id).filter(Boolean);
    const unique = new Set(sessionIds);
    expect(unique.size).toBe(sessionIds.length);
  });
});

// ── C-2: One-device displacement under burst ──────────────────────────────────
describe('C-2: displacement invariant under burst', () => {
  it('sending N new sessions for same user leaves exactly 1 active session', async () => {
    const N = STRESS ? 20 : 5;
    const state = liveState();
    state.user_role_assignments = [{ user_id: 'burst-player', role: 'player' }];
    const admin = buildAdmin(state);

    // Sequential to guarantee displacement ordering (concurrent displacement
    // is non-deterministic in a real DB; in-memory mock is single-threaded)
    for (let i = 0; i < N; i++) {
      const res = await handlePlaybackSession({
        req: new Request('https://local/api/streams/game-1/session', {
          method: 'POST',
          headers: {
            'x-idempotency-key': `c2-key-${i}-${Date.now()}`,
            'x-sbbl-user-id-verified': 'burst-player',
          },
          body: JSON.stringify({ sessionKey: `sk-c2-burst-${i}` }),
        }),
        params: { gameId: 'game-1' },
        env,
        admin,
      } as any);
      expect(res.status).toBe(200);
    }

    const active = state.stream_access_sessions.filter(
      (s) => s.user_id === 'burst-player' && s.status === 'active',
    );
    expect(active.length).toBe(1);

    const displaced = state.stream_access_sessions.filter(
      (s) => s.user_id === 'burst-player' && s.status === 'displaced',
    );
    expect(displaced.length).toBe(N - 1);
  });
});

// ── C-3: Heartbeat storm ──────────────────────────────────────────────────────
describe(`C-3: heartbeat storm — ${VU} concurrent heartbeats`, () => {
  it('every heartbeat returns 200 (active) or 404 (not found) — never 500', async () => {
    const now = Date.now();
    const state = liveState();
    // Pre-seed active sessions for half the VUs
    for (let i = 0; i < VU / 2; i++) {
      state.stream_access_sessions.push({
        id: `sess-${i}`,
        game_id: 'game-1',
        user_id: `hb-player-${i}`,
        status: 'active',
        expires_at: new Date(now + 60_000).toISOString(),
      });
    }
    const admin = buildAdmin(state);

    const results = await Promise.all(
      Array.from({ length: VU }, (_, i) =>
        handleStreamSessionHeartbeat({
          req: new Request('https://local/api/streams/game-1/session/heartbeat', {
            method: 'POST',
            headers: {
              'x-idempotency-key': `c3-hb-${i}-${Date.now()}`,
              'x-sbbl-user-id-verified': `hb-player-${i}`,
            },
            body: JSON.stringify({ sessionId: `sess-${i}` }),
          }),
          params: { gameId: 'game-1' },
          env,
          admin,
        } as any),
      ),
    );

    const statuses = results.map((r) => r.status);
    // Only 200 and 404 are valid — never 500
    expect(statuses.every((s) => s === 200 || s === 404)).toBe(true);
    expect(statuses.includes(500)).toBe(false);
  });
});

// ── C-4: Rate limit self-heal ─────────────────────────────────────────────────
describe('C-4: rate limit RPC failure → in-memory fallback', () => {
  it('handler returns 200 when consume_stream_rate_limit RPC errors (falls back to in-memory)', async () => {
    const state = liveState();
    state.user_role_assignments = [{ user_id: 'player-rl', role: 'player' }];

    const adminWithBrokenRl = {
      from: (table: string) => createQuery(table, state),
      rpc: (name: string, payload: Record<string, unknown>) => {
        if (name === 'consume_stream_rate_limit')
          return Promise.resolve({ data: null, error: { message: 'DB error' } });
        if (name === 'can_user_view_stream')
          return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    } as any;

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': `c4-rl-key-${Date.now()}`,
          'x-sbbl-user-id-verified': 'player-rl',
        },
        body: JSON.stringify({ sessionKey: 'sk-rl-fallback-1' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: adminWithBrokenRl,
    } as any);

    // Must not 500; privileged role player gets through
    expect(res.status).toBe(200);
  });
});

// ── C-5: Session expiry rejected by heartbeat ─────────────────────────────────
describe('C-5: expired session rejected by heartbeat', () => {
  it('heartbeat on expired session returns 404 session_not_found', async () => {
    const state = liveState({
      stream_access_sessions: [{
        id: 'expired-sess',
        game_id: 'game-1',
        user_id: 'player-exp',
        status: 'active',
        // expires_at in the past
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }],
    });

    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/streams/game-1/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': `c5-exp-${Date.now()}`,
          'x-sbbl-user-id-verified': 'player-exp',
        },
        body: JSON.stringify({ sessionId: 'expired-sess' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('session_not_found');
  });

  it('displaced session returns 404 session_not_found', async () => {
    const state = liveState({
      stream_access_sessions: [{
        id: 'displaced-sess',
        game_id: 'game-1',
        user_id: 'player-dis',
        status: 'displaced',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }],
    });

    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/streams/game-1/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': `c5-dis-${Date.now()}`,
          'x-sbbl-user-id-verified': 'player-dis',
        },
        body: JSON.stringify({ sessionId: 'displaced-sess' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: buildAdmin(state),
    } as any);

    expect(res.status).toBe(404);
  });
});

// ── C-6: Idempotency — same key N times = same result ─────────────────────────
describe(`C-6: idempotency — ${ITER} repeated requests with same session key`, () => {
  it('same sessionKey always returns the same maxExpiresAt', async () => {
    const state = liveState();
    state.user_role_assignments = [{ user_id: 'idem-player', role: 'player' }];
    const admin = buildAdmin(state);

    const results: any[] = [];
    for (let i = 0; i < ITER; i++) {
      const res = await handlePlaybackSession({
        req: new Request('https://local/api/streams/game-1/session', {
          method: 'POST',
          headers: {
            'x-idempotency-key': `c6-idem-unique-${i}-${Date.now()}`,
            'x-sbbl-user-id-verified': 'idem-player',
          },
          // Same sessionKey every time — this is the key under test
          body: JSON.stringify({ sessionKey: 'stable-idem-session-key-c6' }),
        }),
        params: { gameId: 'game-1' },
        env,
        admin,
      } as any);
      expect(res.status).toBe(200);
      results.push(await res.json());
    }

    // All iterations must return the same maxExpiresAt (cap is preserved)
    const maxExpiresAtValues = results.map((b) => b.session?.maxExpiresAt);
    const unique = new Set(maxExpiresAtValues);
    expect(unique.size).toBe(1);

    // Only ONE session row for this user (no duplicates)
    const activeSessions = state.stream_access_sessions.filter(
      (s) => s.user_id === 'idem-player' && s.status === 'active',
    );
    expect(activeSessions.length).toBe(1);
  });
});

// ── C-7: Forbidden storm — 403 never leaks 200 ───────────────────────────────
describe(`C-7: forbidden storm — ${VU} unauthorized callers`, () => {
  it('all unauthorized callers receive 403, zero 200s', async () => {
    const state = liveState(); // no role assignments, RPC returns false
    const admin = buildAdmin(state, { can_user_view_stream: false });

    const results = await Promise.all(
      Array.from({ length: VU }, (_, i) =>
        handlePlaybackSession({
          req: new Request('https://local/api/streams/game-1/session', {
            method: 'POST',
            headers: {
              'x-idempotency-key': `c7-forbidden-${i}-${Date.now()}`,
              'x-sbbl-user-id-verified': `blocked-user-${i}`,
            },
            body: JSON.stringify({ sessionKey: `sk-blocked-${i}` }),
          }),
          params: { gameId: 'game-1' },
          env,
          admin,
        } as any),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.every((s) => s === 403)).toBe(true);
    expect(statuses.includes(200)).toBe(false);

    // Zero sessions written
    expect(state.stream_access_sessions.length).toBe(0);
  });
});

// ── C-8: Config bootstrap race ────────────────────────────────────────────────
describe('C-8: concurrent public status polls — consistent responses', () => {
  beforeEach(stubCaches);

  it(`${VU} concurrent polls return consistent isLive and non-negative viewerCount`, async () => {
    const state = liveState();
    const admin = buildAdmin(state);

    const results = await Promise.all(
      Array.from({ length: VU }, () =>
        handlePublicStreamStatus({
          req: new Request('https://local/api/streams/status'),
          admin,
        } as any),
      ),
    );

    const bodies = await Promise.all(results.map((r) => r.json() as Promise<any>));
    // All must agree on isLive
    const isLiveValues = new Set(bodies.map((b) => b.isLive));
    expect(isLiveValues.size).toBe(1);

    // viewerCount is always non-negative
    expect(bodies.every((b) => Number(b.viewerCount) >= 0)).toBe(true);

    // collectionId never leaks
    expect(bodies.every((b) => b.collectionId === undefined)).toBe(true);
  });
});
