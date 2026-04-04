/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import {
  handlePublicStreamStatus,
  handlePlaybackSession,
  handleStreamSessionHeartbeat,
  handlePostComment,
} from '@/worker/index';

type Row = Record<string, unknown>;

function createQuery(table: string, state: Record<string, Row[]>) {
  const filters: Array<(row: Row) => boolean> = [];
  const api: any = {
    eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return api; },
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
    then: async (resolve: (value: unknown) => unknown) => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return resolve({ data: rows, error: null });
    },
    select: () => api,
    update: (patch: Row) => ({
      eq(col: string, val: unknown) {
        const rows = state[table] ?? [];
        const target = rows.find((r) => r[col] === val);
        if (target) Object.assign(target, patch);
        return {
          eq(col2: string, val2: unknown) {
            const ok = target && target[col2] === val2;
            return {
              eq(col3: string, val3: unknown) {
                const ok3 = ok && target && target[col3] === val3;
                return {
                  select: () => ({
                    maybeSingle: async () => ({ data: ok3 ? target : null, error: null }),
                    single: async () => ({ data: ok3 ? target : null, error: ok3 ? null : { message: 'not_found' } }),
                  }),
                };
              },
              select: () => ({
                maybeSingle: async () => ({ data: ok ? target : null, error: null }),
                single: async () => ({ data: ok ? target : null, error: ok ? null : { message: 'not_found' } }),
              }),
            };
          },
          select: () => ({ single: async () => ({ data: target ?? null, error: target ? null : { message: 'not_found' } }) }),
        };
      },
    }),
    insert: (row: Row) => {
      const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
      state[table] = [...(state[table] ?? []), normalized];
      return {
        select: () => ({
          single: async () => ({ data: normalized, error: null }),
        }),
      };
    },
  };
  return api;
}

function createAdmin(state: Record<string, Row[]>) {
  return {
    from(table: string) {
      return createQuery(table, state);
    },
    rpc(name: string, payload: Record<string, unknown>) {
      if (name === 'can_user_view_stream') {
        if (payload.p_user_id === 'allowed-user') return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: false, error: null });
      }
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

describe('stream hardening worker handlers', () => {
  it('public status omits collectionId from payload', async () => {
    (globalThis as unknown as { caches: { default: { match: (req: Request) => Promise<Response | undefined>; put: () => Promise<void> } } }).caches = {
      default: {
        match: async () => undefined,
        put: async () => undefined,
      },
    };
    const state = {
      stream_admin_config: [{ id: true, title: 'Live', is_live: true, active_game_id: 'game-1', collection_id: 'https://secret' }],
      stream_access_sessions: [{ id: 's1', game_id: 'game-1', user_id: 'u1', status: 'active', expires_at: new Date(Date.now() + 30000).toISOString() }],
      stream_sessions: [{ id: 'live-s1', game_id: 'game-1', status: 'live', peak_viewers: 0, current_viewers: 0 }],
    } as Record<string, Row[]>;
    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status'),
      admin: createAdmin(state),
    } as any);
    const body = await res.json() as Record<string, unknown>;
    expect(body.viewerCount).toBe(1);
    expect(body.collectionId).toBeUndefined();
  });

  it('playback session denies unauthorized viewers and allows entitled users', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      stream_admin_config: [{ id: true, collection_id: 'https://playback.example/live.m3u8', title: 'Live', is_live: true }],
      stream_access_sessions: [],
    } as Record<string, Row[]>;

    const denied = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-123456789', 'x-sbbl-user-id-verified': 'blocked-user' },
        body: JSON.stringify({ sessionKey: 'session-key-1' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);
    expect(denied.status).toBe(403);

    const allowed = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-223456789', 'x-sbbl-user-id-verified': 'allowed-user' },
        body: JSON.stringify({ sessionKey: 'session-key-2' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);
    expect(allowed.status).toBe(200);
    const body = await allowed.json() as Record<string, any>;
    expect(body.playback.url).toContain('https://playback.example');
  });

  it('session heartbeat refreshes active presence', async () => {
    const state = {
      api_idempotency_keys: [],
      stream_access_sessions: [{ id: 'sess-1', game_id: 'game-1', user_id: 'allowed-user', status: 'active', expires_at: new Date(Date.now() + 10000).toISOString() }],
    } as Record<string, Row[]>;

    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/streams/game-1/session/heartbeat', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-323456789', 'x-sbbl-user-id-verified': 'allowed-user' },
        body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);

    expect(res.status).toBe(200);
    expect((state.stream_access_sessions[0].status)).toBe('active');
  });

  it('chat validation blocks invalid input and enforces message length', async () => {
    const state = { api_idempotency_keys: [], stream_chat_messages: [] } as Record<string, Row[]>;

    const invalid = await handlePostComment({
      req: new Request('https://local/api/streams/game-1/comments', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-423456789', 'x-sbbl-user-id-verified': 'allowed-user', 'cf-connecting-ip': '1.1.1.1' },
        body: JSON.stringify({ message: '' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);
    expect(invalid.status).toBe(400);

    const valid = await handlePostComment({
      req: new Request('https://local/api/streams/game-1/comments', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-523456789', 'x-sbbl-user-id-verified': 'allowed-user', 'cf-connecting-ip': '1.1.1.1' },
        body: JSON.stringify({ message: 'Great move!' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);
    expect(valid.status).toBe(200);
  });
});
