/**
 * BROADCAST ACCESS — END-TO-END VALIDATION
 *
 * Proves that authorized users can actually receive a playback URL and
 * maintain a session for a live broadcast. Covers every authorized user
 * class and the full chain:
 *
 *   access check → session start → playback URL → heartbeat → session end
 *
 * User classes under test:
 *   A. Registered fan      (completed onboarding, no role)
 *   B. Player              (privileged role, counts as registered)
 *   C. Super admin         (fast-path, bypasses all checks)
 *   D. Unregistered user   (must be blocked at every gate)
 *   E. Offline stream      (registered fan blocked until go-live)
 */

import { describe, expect, it } from 'vitest';
import {
  handleBroadcastStreamAccess,
  handleBroadcastSessionStart,
  handleStreamSessionHeartbeat,
} from '@/worker/index';

// ── Shared fixtures ────────────────────────────────────────────────────────

const STREAM_URL = 'https://cdn.sbbl.io/live/master.m3u8';

type Row = Record<string, unknown>;

function makeAdmin(state: Record<string, Row[]>) {
  function makeQuery(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    const api: Record<string, unknown> = {
      eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return api; },
      is(col: string, val: unknown) { filters.push((r) => r[col] === val || (val === null && r[col] == null)); return api; },
      neq(col: string, val: unknown) { filters.push((r) => r[col] !== val); return api; },
      in(col: string, vals: unknown[]) { filters.push((r) => (vals as unknown[]).includes(r[col])); return api; },
      order() { return api; },
      limit() { return api; },
      select() { return api; },
      gt() { return api; },
      maybeSingle: async () => {
        const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'not_found' } };
      },
      then: async (resolve: (v: unknown) => unknown) => {
        const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
        return resolve({ data: rows, error: null });
      },
      insert: (row: Row) => {
        const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
        (state[table] = state[table] ?? []).push(normalized);
        return { select: () => ({ single: async () => ({ data: normalized, error: null }) }) };
      },
      upsert: (row: Row) => {
        const rows = (state[table] = state[table] ?? []);
        const existing = rows.find(
          (r) =>
            r.user_id === row.user_id &&
            (r.game_id === row.game_id || (r.game_id == null && row.game_id == null)) &&
            r.idempotency_key === row.idempotency_key,
        );
        if (existing) {
          Object.assign(existing, row);
        } else {
          rows.push({ ...row, id: row.id ?? crypto.randomUUID() });
        }
        const result = existing ?? rows[rows.length - 1];
        return { select: () => ({ single: async () => ({ data: result, error: null }) }) };
      },
      update: (patch: Row) => {
        const colFilters: Array<(r: Row) => boolean> = [];
        let applied = false;
        const applyPatch = () => {
          if (applied) return;
          applied = true;
          (state[table] ?? []).forEach((r) => {
            if (colFilters.every((fn) => fn(r))) Object.assign(r, patch);
          });
        };
        const builder: Record<string, unknown> = {
          eq(col: string, val: unknown) { colFilters.push((r) => r[col] === val); return builder; },
          is(col: string, val: unknown) { colFilters.push((r) => r[col] === val || (val === null && r[col] == null)); return builder; },
          neq(col: string, val: unknown) { colFilters.push((r) => r[col] !== val); applyPatch(); return { error: null }; },
          then: (resolve: (v: unknown) => unknown) => { applyPatch(); return Promise.resolve(resolve({ data: null, error: null })); },
          select: () => { applyPatch(); return Promise.resolve({ data: null, error: null }); },
        };
        return builder;
      },
      delete: () => {
        const colFilters: Array<(r: Row) => boolean> = [];
        return {
          eq(col: string, val: unknown) { colFilters.push((r) => r[col] === val); state[table] = (state[table] ?? []).filter((r) => !colFilters.every((fn) => fn(r))); return { error: null }; },
        };
      },
    };
    return api;
  }

  return {
    from: (table: string) => makeQuery(table),
    rpc: async (name: string, payload: Record<string, unknown>) => {
      if (name === 'consume_stream_rate_limit') return { data: true, error: null };
      if (name === 'can_user_view_stream') return { data: false, error: null };
      return { data: null, error: null };
      void payload;
    },
  } as ReturnType<typeof makeAdmin>;
}

function liveStreamState(overrides: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    stream_admin_config: [{
      id: true,
      collection_id: STREAM_URL,
      title: 'SBBL Live Broadcast',
      is_live: true,
      active_game_id: null,
    }],
    api_idempotency_keys: [],
    stream_access_sessions: [],
    user_role_assignments: [],
    profiles: [],
    ...overrides,
  };
}

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 'resend_test',
} as never;

// ── Class A: Registered Fan ────────────────────────────────────────────────

describe('Class A — Registered fan (completed onboarding, no role)', () => {
  const userId = 'fan-registered-001';

  it('A1: access check returns hasAccess=true when broadcast is live', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
    });
    const res = await handleBroadcastStreamAccess({
      req: new Request('https://local/api/broadcast/access', {
        headers: { 'x-sbbl-user-id-verified': userId },
      }),
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; hasAccess: boolean };
    expect(body.ok).toBe(true);
    expect(body.hasAccess).toBe(true);
  });

  it('A2: session start returns a real playback URL', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-fan-a2-123456',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'fan-session-a2-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      playback: { url: string; type: string; heartbeatIntervalSec: number; maxExpiresAt: string };
      session: { id: string; maxExpiresAt: string };
    };
    expect(body.ok).toBe(true);
    // Playback URL must be the configured stream URL — not empty, not a redirect
    expect(body.playback.url).toBe(STREAM_URL);
    expect(body.playback.type).toBe('url');
    expect(body.playback.heartbeatIntervalSec).toBeGreaterThanOrEqual(10);
    // Session must have an ID and a 6-hour cap
    expect(body.session.id).toBeTruthy();
    const capMs = new Date(body.session.maxExpiresAt).getTime() - Date.now();
    expect(capMs).toBeGreaterThan(5 * 60 * 60 * 1000); // > 5 hours remaining
  });

  it('A3: heartbeat extends an active session', async () => {
    const sessionId = crypto.randomUUID();
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
      stream_access_sessions: [{
        id: sessionId,
        user_id: userId,
        game_id: null,
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        idempotency_key: 'fan-session-a3-001',
      }],
    });
    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/broadcast/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-hb-a3-1234567',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionId }),
      }),
      params: { gameId: null },
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; expiresAt: string };
    expect(body.ok).toBe(true);
    // Heartbeat must return a future expiry
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('A4: second device displaces the first session', async () => {
    const oldSessionId = crypto.randomUUID();
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
      stream_access_sessions: [{
        id: oldSessionId,
        user_id: userId,
        game_id: null,
        status: 'active',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        max_expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        idempotency_key: 'old-device-key-001',
      }],
    });

    // New device starts a session with a different sessionKey
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-fan-a4-newdev1',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'new-device-key-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    // Old session must be displaced
    const oldSession = state.stream_access_sessions.find((s) => s.id === oldSessionId);
    expect(oldSession?.status).toBe('displaced');
  });
});

// ── Class B: Player (privileged role) ────────────────────────────────────

describe('Class B — Player role (privileged, treated as registered)', () => {
  const userId = 'player-role-001';

  it('B1: access check returns hasAccess=true', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-02-01T08:00:00Z' }],
    });
    const res = await handleBroadcastStreamAccess({
      req: new Request('https://local/api/broadcast/access', {
        headers: { 'x-sbbl-user-id-verified': userId },
      }),
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, hasAccess: true });
  });

  it('B2: session start delivers playback URL', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-02-01T08:00:00Z' }],
      user_role_assignments: [{ user_id: userId, role: 'player' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-player-b2-12345',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'player-session-b2-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; playback: { url: string } };
    expect(body.ok).toBe(true);
    expect(body.playback.url).toBe(STREAM_URL);
  });
});

// ── Class C: Super Admin ──────────────────────────────────────────────────

describe('Class C — Super admin (fast-path, bypasses all checks)', () => {
  const userId = 'super-admin-001';

  it('C1: gets playback URL even when stream is marked offline', async () => {
    const state = liveStreamState({
      stream_admin_config: [{
        id: true,
        collection_id: STREAM_URL,
        title: 'SBBL Live',
        is_live: false, // ← offline — admin bypasses this
        active_game_id: null,
      }],
      user_role_assignments: [{ user_id: userId, role: 'super_admin' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-admin-c1-123456',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'admin-session-c1-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; playback: { url: string }; session: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.playback.url).toBe(STREAM_URL);
    expect(body.session.id).toBeTruthy();
    expect(state.stream_access_sessions).toHaveLength(0);
  });

  it('C2: heartbeat is always accepted with a synthetic session and no DB session row', async () => {
    const fakeSessionId = crypto.randomUUID();
    const state = liveStreamState({
      user_role_assignments: [{ user_id: userId, role: 'super_admin' }],
      // No session row — admin heartbeat must pass without one
      stream_access_sessions: [],
    });
    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/broadcast/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-admin-c2-123456',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionId: fakeSessionId }),
      }),
      params: { gameId: null },
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; sessionId: string };
    expect(body.ok).toBe(true);
    expect(body.sessionId).toBe(fakeSessionId);
    expect(state.stream_access_sessions).toHaveLength(0);
  });

  it('C3: second broadcast session does not displace super_admin because no DB rows are created', async () => {
    const state = liveStreamState({
      user_role_assignments: [{ user_id: userId, role: 'super_admin' }],
      stream_access_sessions: [],
    });

    const first = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-admin-c3-first',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'admin-session-c3-first' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);
    const second = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-admin-c3-second',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'admin-session-c3-second' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = await first.json() as { session: { id: string } };
    const secondBody = await second.json() as { session: { id: string } };
    expect(firstBody.session.id).toBeTruthy();
    expect(secondBody.session.id).toBeTruthy();
    expect(firstBody.session.id).not.toBe(secondBody.session.id);
    expect(state.stream_access_sessions).toHaveLength(0);
  });
});

// ── Class D: Blocked cases ────────────────────────────────────────────────

describe('Class D — Unauthorized users (must be blocked at every gate)', () => {
  it('D1: unregistered user denied at access check', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: 'unreg-user-d1', onboarding_completed_at: null }],
    });
    const res = await handleBroadcastStreamAccess({
      req: new Request('https://local/api/broadcast/access', {
        headers: { 'x-sbbl-user-id-verified': 'unreg-user-d1' },
      }),
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, hasAccess: false });
  });

  it('D2: unregistered user denied session — cannot receive playback URL', async () => {
    const state = liveStreamState({
      profiles: [{ user_id: 'unreg-user-d2', onboarding_completed_at: null }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-unreg-d2-12345',
          'x-sbbl-user-id-verified': 'unreg-user-d2',
        },
        body: JSON.stringify({ sessionKey: 'unreg-session-d2-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('forbidden');
    // Crucial: no playback URL leaked
    expect((body as Record<string, unknown>).playback).toBeUndefined();
  });

  it('D3: user with no profile row denied session', async () => {
    // profiles table has no row for this user
    const state = liveStreamState({ profiles: [] });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-noprof-d3-1234',
          'x-sbbl-user-id-verified': 'no-profile-user-d3',
        },
        body: JSON.stringify({ sessionKey: 'noprofile-session-d3' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('D4: heartbeat for a non-existent session returns session_not_found', async () => {
    const state = liveStreamState();
    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/broadcast/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-hb-d4-12345678',
          'x-sbbl-user-id-verified': 'fan-registered-001',
        },
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      }),
      params: { gameId: null },
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'session_not_found' });
  });

  it('D5: heartbeat for a displaced session returns session_not_found', async () => {
    const sessionId = crypto.randomUUID();
    const state = liveStreamState({
      stream_access_sessions: [{
        id: sessionId,
        user_id: 'fan-registered-001',
        game_id: null,
        status: 'displaced', // ← kicked off by another device
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      }],
    });
    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/broadcast/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-hb-d5-12345678',
          'x-sbbl-user-id-verified': 'fan-registered-001',
        },
        body: JSON.stringify({ sessionId }),
      }),
      params: { gameId: null },
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'session_not_found' });
  });
});

// ── Class E: Offline stream ───────────────────────────────────────────────

describe('Class E — Offline broadcast (registered fans blocked until go-live)', () => {
  const userId = 'fan-offline-e-001';

  it('E1: access check returns hasAccess=false when stream is offline', async () => {
    const state = liveStreamState({
      stream_admin_config: [{
        id: true,
        collection_id: STREAM_URL,
        title: 'SBBL Live',
        is_live: false,
        active_game_id: null,
      }],
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
    });
    const res = await handleBroadcastStreamAccess({
      req: new Request('https://local/api/broadcast/access', {
        headers: { 'x-sbbl-user-id-verified': userId },
      }),
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, hasAccess: false });
  });

  it('E2: session start returns stream_offline when broadcast is down', async () => {
    const state = liveStreamState({
      stream_admin_config: [{
        id: true,
        collection_id: STREAM_URL,
        title: 'SBBL Live',
        is_live: false,
        active_game_id: null,
      }],
      profiles: [{ user_id: userId, onboarding_completed_at: '2026-01-15T10:00:00Z' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-offline-e2-1234',
          'x-sbbl-user-id-verified': userId,
        },
        body: JSON.stringify({ sessionKey: 'offline-session-e2-001' }),
      }),
      params: {},
      env: ENV,
      admin: makeAdmin(state),
    } as never);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'stream_offline' });
  });
});
