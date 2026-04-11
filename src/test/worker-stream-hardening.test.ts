/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import {
  handlePublicStreamStatus,
  handlePlaybackSession,
  handleStreamSessionHeartbeat,
  handlePostComment,
  handleSetStreamStatus,
  handleTestStreamSource,
  handleUpdateStreamConfig,
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
    update: (patch: Row) => {
      // Chainable filter builder for update().eq()...neq()
      // Supports the displacement query: .eq(status).eq(user_id).eq(game_id).neq(idempotency_key)
      const colFilters: Array<(r: Row) => boolean> = [];
      const applyPatch = () => {
        (state[table] ?? []).forEach((r) => {
          if (colFilters.every((fn) => fn(r))) Object.assign(r, patch);
        });
      };
      const builder: any = {
        eq(col: string, val: unknown) {
          colFilters.push((r) => r[col] === val);
          return builder;
        },
        neq(col: string, val: unknown) {
          colFilters.push((r) => r[col] !== val);
          // neq terminates the displacement chain — apply patch now
          applyPatch();
          return { error: null };
        },
        select: () => {
          // select after update chain — find updated target for maybeSingle/single
          const rows = state[table] ?? [];
          const target = rows.find((r) => colFilters.every((fn) => fn(r)));
          return {
            maybeSingle: async () => ({ data: target ?? null, error: null }),
            single: async () => ({ data: target ?? null, error: target ? null : { message: 'not_found' } }),
          };
        },
      };
      return builder;
    },
    insert: (row: Row) => {
      const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
      state[table] = [...(state[table] ?? []), normalized];
      return {
        select: () => ({
          single: async () => ({ data: normalized, error: null }),
        }),
      };
    },
    upsert: (row: Row, _opts?: unknown) => {
      const rows = state[table] ?? [];
      // Simple upsert: find by matching unique key fields, update or insert
      const existing = rows.find((r) =>
        (row.user_id ? r.user_id === row.user_id && r.game_id === row.game_id && r.idempotency_key === row.idempotency_key : r.id === row.id)
      );
      if (existing) {
        Object.assign(existing, row);
      } else {
        const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
        state[table] = [...rows, normalized];
      }
      const result = existing ?? state[table][state[table].length - 1];
      return {
        select: () => ({
          single: async () => ({ data: result, error: null }),
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
    expect(body.viewerCount).toBe(0);
    expect(body.collectionId).toBeUndefined();
  });

  it('playback session denies unauthorized viewers and allows entitled users', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-1', status: 'live' }],
      stream_admin_config: [{ id: true, collection_id: 'https://playback.example/live.m3u8', title: 'Live', is_live: true, source_status: 'valid' }],
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

  it('session heartbeat returns session_not_found for displaced/missing sessions', async () => {
    const state = {
      api_idempotency_keys: [],
      stream_access_sessions: [{ id: 'sess-1', game_id: 'game-1', user_id: 'allowed-user', status: 'displaced', expires_at: new Date(Date.now() + 10000).toISOString() }],
    } as Record<string, Row[]>;

    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/streams/game-1/session/heartbeat', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-623456789', 'x-sbbl-user-id-verified': 'allowed-user' },
        body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'session_not_found' });
  });

  it('playback session keeps one-device displacement and 6-hour maxExpiresAt', async () => {
    const now = Date.now();
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-1', status: 'live' }],
      stream_admin_config: [{ id: true, collection_id: 'https://playback.example/live.m3u8', title: 'Live', is_live: true, source_status: 'valid' }],
      stream_access_sessions: [{
        id: 'old-sess',
        game_id: 'game-1',
        user_id: 'allowed-user',
        status: 'active',
        expires_at: new Date(now + 30_000).toISOString(),
        idempotency_key: 'old-session-key',
      }],
    } as Record<string, Row[]>;

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idempotency-key-723456789', 'x-sbbl-user-id-verified': 'allowed-user' },
        body: JSON.stringify({ sessionKey: 'new-session-key' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    const maxExpiresAt = new Date(body.session.maxExpiresAt).getTime();
    expect(maxExpiresAt).toBeGreaterThanOrEqual(now + (6 * 60 * 60 * 1000) - 2_000);
    expect(maxExpiresAt).toBeLessThanOrEqual(Date.now() + (6 * 60 * 60 * 1000) + 2_000);
    expect((state.stream_access_sessions[0].status)).toBe('displaced');
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

  it('blocks live transition when gameId is missing', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [{ user_id: 'admin-1', role: 'super_admin' }],
      stream_admin_config: [{ id: true, source_status: 'valid' }],
    } as Record<string, Row[]>;

    const res = await handleSetStreamStatus({
      req: new Request('https://local/ops/streams/status', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-live-12345', 'x-sbbl-user-id-verified': 'admin-1' },
        body: JSON.stringify({ isLive: true }),
      }),
      params: {},
      env,
      admin: createAdmin(state),
    } as any);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'game_id_required_for_live' });
  });

  it('blocks live transition when source has not been tested', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [{ user_id: 'admin-1', role: 'super_admin' }],
      stream_admin_config: [{ id: true, source_status: 'untested' }],
    } as Record<string, Row[]>;
    const res = await handleSetStreamStatus({
      req: new Request('https://local/ops/streams/status', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-live-22345', 'x-sbbl-user-id-verified': 'admin-1' },
        body: JSON.stringify({ isLive: true, gameId: 'game-1' }),
      }),
      params: {},
      env,
      admin: createAdmin(state),
    } as any);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'source_test_required' });
  });

  it('rejects facebook profile.php?id source URL', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [{ user_id: 'admin-1', role: 'super_admin' }],
    } as Record<string, Row[]>;
    const res = await handleTestStreamSource({
      req: new Request('https://local/api/streams/game-1/test-source', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-test-src-12345', 'x-sbbl-user-id-verified': 'admin-1' },
        body: JSON.stringify({ collectionId: 'https://facebook.com/profile.php?id=123' }),
      }),
      params: { gameId: 'game-1' },
      env,
      admin: createAdmin(state),
    } as any);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      validation: { ok: false, blockingReason: 'facebook_profile_id_unsupported' },
    });
  });

  it('config save persists normalized facebook metadata', async () => {
    (globalThis as unknown as { caches: { default: { delete: () => Promise<boolean> } } }).caches = {
      default: { delete: async () => true },
    };
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [{ user_id: 'admin-1', role: 'super_admin' }],
      stream_admin_config: [{ id: true }],
      audit_logs: [],
    } as Record<string, Row[]>;
    const res = await handleUpdateStreamConfig({
      req: new Request('https://local/ops/streams/config', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-cfg-123456', 'x-sbbl-user-id-verified': 'admin-1' },
        body: JSON.stringify({ collectionId: 'https://facebook.com/SBBLhq?fbclid=abc', title: 'Finals' }),
      }),
      params: {},
      env,
      admin: createAdmin(state),
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.config.collectionId).toBe('https://facebook.com/SBBLhq/live');
    expect(body.config.sourceStatus).toBe('valid_with_warning');
  });
});
