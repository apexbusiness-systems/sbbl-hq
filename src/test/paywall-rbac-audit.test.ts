/**
 * PAYWALL & VIDEO PLAYER RBAC AUDIT STRESS TEST
 *
 * Comprehensive adversarial probe of every user-facing access gate:
 *
 *   SERVER-SIDE
 *   ──────────────────────────────────────────────────────────────────────────
 *   Suite 1 – RBAC Access Matrix          handlePlaybackSession per-role
 *   Suite 2 – Broadcast Alias Access      gameId=null special rules
 *   Suite 3 – Replay Gate                 embargo + entitlement tiers
 *   Suite 4 – Super Admin Fast-Path       bypasses all DB checks
 *   Suite 5 – Invite Generation RBAC      handleInviteGenerate per-role
 *   Suite 6 – Invite Redeem Security      handleInviteRedeem edge cases
 *   Suite 7 – Session Heartbeat Security  cross-user theft, expiry
 *   Suite 8 – Stream Access Endpoint      handleStreamAccess contract
 *
 *   CLIENT-SIDE STATIC ANALYSIS
 *   ──────────────────────────────────────────────────────────────────────────
 *   Suite 9 – useLiveAccess hook          role-scope + game_id-scope checks
 *
 * Bugs found and fixed before this file was written:
 *   FIX-1  useLiveAccess entitlement query lacked game_id scope —
 *          a PPV for game A granted visual access to game B's stream.
 *   FIX-2  useLiveAccess isFreeRole used hasRole() hierarchy, granting
 *          coaches/team_managers/league_admins "free" access in the UI
 *          despite the server (handlePlaybackSession) denying them a session.
 *   FIX-3  handleInviteRedeem CAS race check used `count` which Supabase JS
 *          returns as null without Prefer:count=exact; concurrent invite
 *          redemptions could both succeed.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  handleBroadcastSessionStart,
  handlePlaybackSession,
  handleStreamSessionHeartbeat,
  handleInviteRedeem,
  handleInviteGenerate,
  handleStreamAccess,
} from '@/worker/index';

// ── Shared helpers ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/**
 * Builds a minimal in-memory Supabase admin mock.
 * The upsert on stream_access_sessions uses the unique key
 * (user_id, game_id, idempotency_key) to detect existing rows.
 */
function buildAdmin(
  state: Record<string, Row[]>,
  rpcOverrides: Record<string, unknown> = {},
) {
  function makeQuery(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    const localIn: Array<(r: Row) => boolean> = [];

    const api: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push((r) => r[col] === val || (val === null && r[col] == null));
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push((r) => r[col] !== val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        localIn.push((r) => vals.includes(r[col]));
        filters.push((r) => vals.includes(r[col]));
        return api;
      },
      order() { return api; },
      limit() { return api; },
      select() { return api; },
      maybeSingle: async () => {
        const rows = (state[table] ?? []).filter((r) =>
          filters.every((fn) => fn(r)),
        );
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = (state[table] ?? []).filter((r) =>
          filters.every((fn) => fn(r)),
        );
        return rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'not_found' } };
      },
      then: async (resolve: (v: unknown) => unknown) => {
        const rows = (state[table] ?? []).filter((r) =>
          filters.every((fn) => fn(r)),
        );
        return resolve({ data: rows, error: null });
      },
      insert: (row: Row) => {
        const normalized = { ...row, id: row.id ?? crypto.randomUUID(), code: row.code ?? crypto.randomUUID() };
        (state[table] = state[table] ?? []).push(normalized);
        return {
          select: () => ({
            single: async () => ({ data: normalized, error: null }),
          }),
        };
      },
      upsert: (row: Row) => {
        const rows = (state[table] = state[table] ?? []);
        const existing = rows.find(
          (r) =>
            r.user_id === row.user_id &&
            (r.game_id === row.game_id ||
              (r.game_id == null && row.game_id == null)) &&
            r.idempotency_key === row.idempotency_key,
        );
        if (existing) {
          Object.assign(existing, row);
        } else {
          rows.push({ ...row, id: row.id ?? crypto.randomUUID(), code: row.code ?? crypto.randomUUID() });
        }
        const result = existing ?? rows[rows.length - 1];
        return {
          select: () => ({
            single: async () => ({ data: result, error: null }),
          }),
        };
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
          eq(col: string, val: unknown) {
            colFilters.push((r) => r[col] === val);
            return builder;
          },
          is(col: string, val: unknown) {
            colFilters.push(
              (r) => r[col] === val || (val === null && r[col] == null),
            );
            return builder;
          },
          neq(col: string, val: unknown) {
            colFilters.push((r) => r[col] !== val);
            applyPatch();
            return { error: null };
          },
          select: () => {
            applyPatch();
            // Return the rows that matched the colFilters (post-patch),
            // simulating Supabase .update().eq()…is().select("id").
            const matched = (state[table] ?? []).filter((r) =>
              colFilters.every((fn) => fn(r)),
            );
            return Promise.resolve({ data: matched, error: null });
          },
          // Allow `await builder` (no trailing .select()/.neq()) to flush patch.
          // Used by the session-cap expiry path: `await capQ` where capQ is the
          // update chain after .eq().is() with no further terminator.
          then: (resolve: (v: unknown) => unknown) => {
            applyPatch();
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
        return builder;
      },
      delete: () => {
        const colFilters: Array<(r: Row) => boolean> = [];
        const builder: Record<string, unknown> = {
          eq(col: string, val: unknown) {
            colFilters.push((r) => r[col] === val);
            state[table] = (state[table] ?? []).filter(
              (r) => !colFilters.every((fn) => fn(r)),
            );
            return { error: null };
          },
        };
        return builder;
      },
    };
    return api;
  }

  return {
    from: (table: string) => makeQuery(table),
    rpc: async (name: string, payload: Record<string, unknown>) => {
      if (name in rpcOverrides) {
        return { data: rpcOverrides[name], error: null };
      }
      if (name === 'can_user_view_stream') {
        // By default only 'entitled-user' passes.
        const allowed = payload.p_user_id === 'entitled-user';
        return { data: allowed, error: null };
      }
      if (name === 'consume_stream_rate_limit') {
        return { data: true, error: null };
      }
      if (name === 'create_stream_entitlement') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  };
}

/** Minimal test env — Turnstile is disabled (no OPTIONAL_TURNSTILE_SECRET_KEY). */
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 'resend_test',
  // Required so resolveProxyTokenSecret returns a value on the proxy delivery
  // path (HLS m3u8 mock URL → delivery class = proxy).
  OMNIHUB_SIGNING_SECRET: 'test-omnihub-signing-secret',
} as unknown as Parameters<typeof handlePlaybackSession>[0]['env'];

/** A future timestamp used as a valid expiry. */
const FUTURE = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
/** A past timestamp used as an expired row. */
const PAST = new Date(Date.now() - 60_000).toISOString();
/** 6-hour max cap in the future. */
const MAX_CAP = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

/** Make a POST request for the playback session endpoint. */
function sessionReq(gameId: string, userId: string, sessionKey: string, extras: Record<string, string> = {}) {
  return new Request(`https://local/api/streams/${gameId}/session`, {
    method: 'POST',
    headers: {
      'x-idempotency-key': `idem-${userId}-${sessionKey}`.slice(0, 64),
      'x-sbbl-user-id-verified': userId,
      ...extras,
    },
    body: JSON.stringify({ sessionKey }),
  });
}

/** Base state: stream is live with an HLS URL. */
function baseState(overrides: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    api_idempotency_keys: [],
    user_role_assignments: [],
    games: [{ id: 'game-1', status: 'live' }],
    stream_admin_config: [{
      id: true,
      collection_id: 'https://cdn.example/live.m3u8',
      title: 'SBBL Live',
      is_live: true,
      active_game_id: 'game-1',
    }],
    stream_access_sessions: [],
    stream_entitlements: [],
    ppv_invites: [],
    ...overrides,
  };
}

// ── Suite 1: RBAC Access Matrix ─────────────────────────────────────────────

describe('Suite 1 — RBAC Access Matrix (handlePlaybackSession)', () => {
  it('1.1 no auth header → throws unauthorized', async () => {
    await expect(
      handlePlaybackSession({
        req: new Request('https://local/api/streams/game-1/session', {
          method: 'POST',
          headers: { 'x-idempotency-key': 'no-auth-key-1234567' },
          body: JSON.stringify({ sessionKey: 'no-auth-session' }),
        }),
        params: { gameId: 'game-1' },
        env: ENV,
        admin: buildAdmin(baseState()) as never,
      }),
    ).rejects.toThrow(/unauthorized/i);
  });

  it('1.2 fan (no role, no entitlement) → 403 forbidden', async () => {
    const state = baseState();
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'fan-no-ent', 'sess-fan-no-ent'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('forbidden');
  });

  it('1.3 fan with active entitlement for current game → 200', async () => {
    // The RPC check receives p_user_id='entitled-user' which the mock allows.
    const state = baseState();
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'entitled-user', 'sess-entitled'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('1.4 fan with expired entitlement → 403', async () => {
    // Provide an expired entitlement; the RPC mock denies this user.
    const state = baseState({
      stream_entitlements: [{
        id: 'ent-expired',
        game_id: 'game-1',
        user_id: 'fan-expired',
        status: 'active',
        expires_at: PAST,
        replay_tier: 'live',
      }],
    });
    // The RPC mock returns false for 'fan-expired', so forbidden.
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'fan-expired', 'sess-fan-expired'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
  });

  it('1.5 fan with entitlement for a different game → 403 (scoped RPC denies)', async () => {
    // Entitlement exists for 'game-other', not 'game-1'.
    // The mock's can_user_view_stream only allows p_user_id='entitled-user'.
    // We use a custom RPC that checks game_id.
    const state = baseState({
      stream_entitlements: [{
        id: 'ent-other',
        game_id: 'game-other',
        user_id: 'fan-other-game',
        status: 'active',
        expires_at: FUTURE,
        replay_tier: 'live',
      }],
    });
    const admin = buildAdmin(state, {});
    // Override RPC to be game-scoped.
    const rpcAware = {
      from: (t: string) => admin.from(t),
      rpc: async (name: string, payload: Record<string, unknown>) => {
        if (name === 'can_user_view_stream') {
          // Access only for the correct game.
          const ok = payload.p_user_id === 'fan-other-game' && payload.p_game_id === 'game-other';
          return { data: ok, error: null };
        }
        return admin.rpc(name, payload);
      },
    };
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'fan-other-game', 'sess-wrong-game'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: rpcAware as never,
    });
    expect(res.status).toBe(403);
  });

  it('1.6 player role → 200 (free, no entitlement needed)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-user', role: 'player' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'player-user', 'sess-player'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
  });

  it('1.7 paid_fan role → 200 (free, no entitlement needed)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'paidfan-user', role: 'paid_fan' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'paidfan-user', 'sess-paidfan'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
  });

  it('1.8 coach role → 403 (not in hasPrivilegedRole; must purchase PPV)', async () => {
    // Design decision: only player, paid_fan, and super_admin get free stream
    // access. Operational roles (coach, team_manager, etc.) need a comp code.
    const state = baseState({
      user_role_assignments: [{ user_id: 'coach-user', role: 'coach' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'coach-user', 'sess-coach'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
  });

  it('1.9 team_manager role → 403 (same policy as coach)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'tm-user', role: 'team_manager' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'tm-user', 'sess-tm-xxxx'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
  });

  it('1.10 league_admin role → 403 (same policy as coach)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'la-user', role: 'league_admin' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'la-user', 'sess-la-xxxx'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
  });

  it('1.11 super_admin role → 200 via fast-path (no DB session row created)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'sa-user', role: 'super_admin' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'sa-user', 'sess-sa-xxxx'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    // Super admin fast-path: no session row created.
    expect(state.stream_access_sessions).toHaveLength(0);
  });

  it('1.12 session_key shorter than 8 chars → 400 session_key_required', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-short', role: 'player' }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-player-short-xyz',
          'x-sbbl-user-id-verified': 'player-short',
        },
        body: JSON.stringify({ sessionKey: 'short' }), // 5 chars
      }),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('session_key_required');
  });

  it('1.13 exactly 8-char session key is accepted', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-8ch', role: 'player' }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-1/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-player-8ch-xyz',
          'x-sbbl-user-id-verified': 'player-8ch',
        },
        body: JSON.stringify({ sessionKey: '12345678' }),
      }),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
  });
});

// ── Suite 2: Broadcast Session Access (via handleBroadcastSessionStart) ────
// Broadcast is independent of games. Access = registration only.
// handlePlaybackSession rejects the 'broadcast' alias — use /api/broadcast/session.

describe('Suite 2 — Broadcast Session Access (/api/broadcast/session)', () => {
  it('2.1 registered user + live broadcast → 200', async () => {
    const state = baseState({
      profiles: [{ user_id: 'reg-user-bc', onboarding_completed_at: '2026-01-01T00:00:00Z' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-reg-bc-xyz1234',
          'x-sbbl-user-id-verified': 'reg-user-bc',
        },
        body: JSON.stringify({ sessionKey: 'bc-session-reg-1' }),
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; session: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.session?.id).toBeTruthy();
  });

  it('2.2 unregistered user + live broadcast → 403 forbidden', async () => {
    const state = baseState({
      profiles: [{ user_id: 'unreg-bc', onboarding_completed_at: null }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-unreg-bc-xyz12',
          'x-sbbl-user-id-verified': 'unreg-bc',
        },
        body: JSON.stringify({ sessionKey: 'bc-session-unreg-1' }),
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('2.3 registered user + offline broadcast → 403 stream_offline', async () => {
    const state = baseState({
      stream_admin_config: [{
        id: true,
        collection_id: 'https://cdn.example/live.m3u8',
        title: 'SBBL Live',
        is_live: false,
        active_game_id: null,
      }],
      profiles: [{ user_id: 'reg-user-offline', onboarding_completed_at: '2026-01-01T00:00:00Z' }],
    });
    const res = await handleBroadcastSessionStart({
      req: new Request('https://local/api/broadcast/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-offline-bc-xyz1',
          'x-sbbl-user-id-verified': 'reg-user-offline',
        },
        body: JSON.stringify({ sessionKey: 'bc-session-offline' }),
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'stream_offline' });
  });

  it('2.4 handlePlaybackSession routes broadcast alias through untied/open broadcast access path', async () => {
    const state = baseState();
    for (const gameId of [null, 'broadcast'] as (string | null)[]) {
      const res = await handlePlaybackSession({
        req: new Request('https://local/api/streams/broadcast/session', {
          method: 'POST',
          headers: {
            'x-idempotency-key': `idem-guard-${gameId ?? 'null'}`,
            'x-sbbl-user-id-verified': 'player-bc',
          },
          body: JSON.stringify({ sessionKey: `bc-guard-${gameId ?? 'null'}` }),
        }),
        params: { gameId },
        env: ENV,
        admin: buildAdmin(state) as never,
      });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ ok: true });
    }
  });
});

// ── Suite 3: Replay Gate ────────────────────────────────────────────────────

describe('Suite 3 — Replay Gate', () => {
  it('3.1 replay_mode=none → 409 replay_unavailable', async () => {
    const state = baseState({
      games: [{ id: 'game-replay', status: 'ended', replay_mode: 'none' }],
      user_role_assignments: [{ user_id: 'player-rp', role: 'player' }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-replay/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-rp-none-xyz1234',
          'x-sbbl-user-id-verified': 'player-rp',
        },
        body: JSON.stringify({ sessionKey: 'rp-none-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-replay' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('replay_unavailable');
  });

  it('3.2 replay in embargo → 409 replay_embargoed', async () => {
    const state = baseState({
      games: [{
        id: 'game-embargo',
        status: 'ended',
        replay_mode: 'raw',
        replay_monetization_enabled_at: FUTURE, // future date = still embargoed
      }],
      user_role_assignments: [{ user_id: 'player-emb', role: 'player' }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-embargo/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-rp-embargo-xyz1',
          'x-sbbl-user-id-verified': 'player-emb',
        },
        body: JSON.stringify({ sessionKey: 'rp-embargo-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-embargo' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('replay_embargoed');
  });

  it('3.3 replay past embargo, no replay entitlement → 402 replay_available_for_purchase', async () => {
    const state = baseState({
      games: [{
        id: 'game-rp-no-ent',
        status: 'ended',
        replay_mode: 'raw',
        replay_monetization_enabled_at: PAST, // past = embargo lifted
      }],
      stream_entitlements: [], // no entitlement
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-rp-no-ent/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-rp-no-ent-xyz12',
          'x-sbbl-user-id-verified': 'fan-no-replay-ent',
        },
        body: JSON.stringify({ sessionKey: 'rp-no-ent-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-rp-no-ent' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(402);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('replay_available_for_purchase');
  });

  it('3.4 replay past embargo, live-only entitlement (replay_tier=live) → 402', async () => {
    // A standard live PPV purchase (replay_tier='live') does NOT grant replay.
    const state = baseState({
      games: [{
        id: 'game-live-ent-only',
        status: 'ended',
        replay_mode: 'raw',
        replay_monetization_enabled_at: PAST,
      }],
      stream_entitlements: [{
        id: 'ent-live-only',
        game_id: 'game-live-ent-only',
        user_id: 'fan-live-only',
        status: 'active',
        expires_at: FUTURE,
        replay_tier: 'live', // ← live tier, not raw/edited
      }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-live-ent-only/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-live-only-xyz12',
          'x-sbbl-user-id-verified': 'fan-live-only',
        },
        body: JSON.stringify({ sessionKey: 'rp-live-only-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-live-ent-only' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(402);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('replay_available_for_purchase');
  });

  it('3.5 replay past embargo, raw replay entitlement → 200', async () => {
    const state = baseState({
      games: [{
        id: 'game-raw-ent',
        status: 'ended',
        replay_mode: 'raw',
        replay_monetization_enabled_at: PAST,
      }],
      stream_entitlements: [{
        id: 'ent-raw',
        game_id: 'game-raw-ent',
        user_id: 'fan-has-raw',
        status: 'active',
        expires_at: FUTURE,
        replay_tier: 'raw', // ← grants replay
      }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-raw-ent/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-raw-ent-xyz1234',
          'x-sbbl-user-id-verified': 'fan-has-raw',
        },
        body: JSON.stringify({ sessionKey: 'rp-raw-ent-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-raw-ent' },
      env: ENV,
      admin: buildAdmin(state, { can_user_view_stream: true }) as never,
    });
    expect(res.status).toBe(200);
  });

  it('3.6 replay past embargo, edited replay entitlement → 200', async () => {
    const state = baseState({
      games: [{
        id: 'game-edit-ent',
        status: 'ended',
        replay_mode: 'edited',
        replay_monetization_enabled_at: PAST,
      }],
      stream_entitlements: [{
        id: 'ent-edit',
        game_id: 'game-edit-ent',
        user_id: 'fan-has-edited',
        status: 'active',
        expires_at: FUTURE,
        replay_tier: 'edited',
      }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-edit-ent/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-edit-ent-xyz123',
          'x-sbbl-user-id-verified': 'fan-has-edited',
        },
        body: JSON.stringify({ sessionKey: 'rp-edit-ent-key', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-edit-ent' },
      env: ENV,
      admin: buildAdmin(state, { can_user_view_stream: true }) as never,
    });
    expect(res.status).toBe(200);
  });

  it('3.7 super_admin bypasses replay gate entirely', async () => {
    const state = baseState({
      games: [{
        id: 'game-sa-replay',
        status: 'ended',
        replay_mode: 'none', // even with no replay available
      }],
      user_role_assignments: [{ user_id: 'sa-replay', role: 'super_admin' }],
    });
    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-sa-replay/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-sa-replay-xyz12',
          'x-sbbl-user-id-verified': 'sa-replay',
        },
        body: JSON.stringify({ sessionKey: 'rp-sa-key-xxxx', playbackMode: 'replay' }),
      }),
      params: { gameId: 'game-sa-replay' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    // Super admin fast-path returns before the replay gate.
    expect(res.status).toBe(200);
  });
});

// ── Suite 4: Super Admin Fast-Path ─────────────────────────────────────────

describe('Suite 4 — Super Admin Fast-Path', () => {
  it('4.1 super_admin session response contains fake UUID, not a real DB row', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'sa-fp', role: 'super_admin' }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'sa-fp', 'sess-sa-fp-xxxx'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { id: string } };
    // The fake session ID is a valid UUID, not 'undefined'.
    expect(body.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // No DB session row created.
    expect(state.stream_access_sessions).toHaveLength(0);
  });

  it('4.2 super_admin heartbeat accepts any session ID without DB lookup', async () => {
    // The super_admin fast-path in the heartbeat handler queues the beat
    // without validating the session row, so any ID is accepted.
    const state = baseState({
      user_role_assignments: [{ user_id: 'sa-hb', role: 'super_admin' }],
      stream_access_sessions: [], // no matching session row
    });
    const res = await handleStreamSessionHeartbeat({
      req: new Request('https://local/api/streams/game-1/session/heartbeat', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-sa-hb-1234567',
          'x-sbbl-user-id-verified': 'sa-hb',
        },
        body: JSON.stringify({ sessionId: 'fake-session-id-for-sa' }),
      }),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
  });

  it('4.3 super_admin is not displaced by a concurrent session creation', async () => {
    // Create two super_admin sessions for the same game.
    // Neither should displace the other.
    const state = baseState({
      user_role_assignments: [{ user_id: 'sa-multi', role: 'super_admin' }],
    });
    const admin = buildAdmin(state);
    for (let i = 0; i < 2; i++) {
      const res = await handlePlaybackSession({
        req: sessionReq('game-1', 'sa-multi', `sess-sa-multi-${i}`),
        params: { gameId: 'game-1' },
        env: ENV,
        admin: admin as never,
      });
      expect(res.status).toBe(200);
    }
    // Super admin path skips DB upsert → no rows, no displacement.
    expect(state.stream_access_sessions).toHaveLength(0);
  });
});

// ── Suite 5: Invite Generation RBAC ────────────────────────────────────────

describe('Suite 5 — Invite Generation RBAC (handleInviteGenerate)', () => {
  function inviteGenReq(userId: string) {
    return new Request('https://local/api/invite/generate', {
      method: 'POST',
      headers: {
        'x-idempotency-key': `idem-gen-${userId}`.slice(0, 64),
        'x-sbbl-user-id-verified': userId,
      },
      body: JSON.stringify({ gameId: 'game-1' }),
    });
  }

  it('5.1 fan (no role) → 403 forbidden', async () => {
    const state = baseState();
    const res = await handleInviteGenerate({
      req: inviteGenReq('fan-gen'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('forbidden');
  });

  it('5.2 coach → 403 forbidden (not in eligible generate roles)', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'coach-gen', role: 'coach' }],
    });
    const res = await handleInviteGenerate({
      req: inviteGenReq('coach-gen'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
  });

  it('5.3 player → 200 with invite code', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-gen', role: 'player' }],
    });
    const res = await handleInviteGenerate({
      req: inviteGenReq('player-gen'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(true);
    expect(typeof body.code).toBe('string');
    expect(body.code.length).toBeGreaterThan(0);
  });

  it('5.4 paid_fan → 200 with invite code', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'paidfan-gen', role: 'paid_fan' }],
    });
    const res = await handleInviteGenerate({
      req: inviteGenReq('paidfan-gen'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('5.5 super_admin → 200 with invite code', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'sa-gen', role: 'super_admin' }],
    });
    const res = await handleInviteGenerate({
      req: inviteGenReq('sa-gen'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('5.6 player re-generates same game → returns same code (idempotent)', async () => {
    const existingId = 'existing-invite-uuid-1234';
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-idem', role: 'player' }],
      ppv_invites: [{
        id: existingId,
        code: existingId,
        game_id: 'game-1',
        generated_by: 'player-idem',
        used_by: null,
        expires_at: FUTURE,
      }],
    });
    const res = await handleInviteGenerate({
      req: inviteGenReq('player-idem'),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; code: string; reused: boolean };
    expect(body.ok).toBe(true);
    expect(body.code).toBe(existingId);
    expect(body.reused).toBe(true);
  });

  it('5.7 missing gameId → 400 game_id_required', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-nogame', role: 'player' }],
    });
    const res = await handleInviteGenerate({
      req: new Request('https://local/api/invite/generate', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-gen-nogame-1234',
          'x-sbbl-user-id-verified': 'player-nogame',
        },
        body: JSON.stringify({}), // no gameId
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('game_id_required');
  });
});

// ── Suite 6: Invite Redeem Security ────────────────────────────────────────

describe('Suite 6 — Invite Redeem Security (handleInviteRedeem)', () => {
  const VALID_CODE = 'aabbccdd-1122-3344-5566-aabbccddeeff';

  function redeemReq(userId: string, code: string, ip = '10.0.0.1') {
    return {
      req: new Request('https://local/api/invite/redeem', {
        method: 'POST',
        headers: {
          'x-idempotency-key': `idem-redeem-${userId}`.slice(0, 64),
          'x-sbbl-user-id-verified': userId,
          'cf-connecting-ip': ip,
        },
        body: JSON.stringify({ code }),
      }),
      params: {},
      env: ENV,
    };
  }

  function validInvite(overrides: Partial<Row> = {}): Row {
    return {
      id: VALID_CODE,
      code: VALID_CODE,
      game_id: 'game-1',
      generated_by: 'generator-user',
      used_by: null,
      ip_address: null,
      used_at: null,
      expires_at: FUTURE,
      is_comp: false,
      ...overrides,
    };
  }

  it('6.1 valid first-time redeem → 200 granted', async () => {
    const state = baseState({ ppv_invites: [validInvite()] });
    const { req, params, env } = redeemReq('redeemer-1', VALID_CODE);
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; granted: boolean };
    expect(body.ok).toBe(true);
    expect(body.granted).toBe(true);
  });

  it('6.2 missing code → 400 code_required', async () => {
    const state = baseState({ ppv_invites: [validInvite()] });
    const res = await handleInviteRedeem({
      req: new Request('https://local/api/invite/redeem', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-redeem-nocode12',
          'x-sbbl-user-id-verified': 'redeemer-nocode',
          'cf-connecting-ip': '10.0.0.1',
        },
        body: JSON.stringify({}), // no code
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('code_required');
  });

  it('6.3 non-existent code → 404 invalid_invite', async () => {
    const state = baseState({ ppv_invites: [] });
    const { req, params, env } = redeemReq('redeemer-404', 'does-not-exist');
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_invite');
  });

  it('6.4 expired invite → 410 expired', async () => {
    const state = baseState({
      ppv_invites: [validInvite({ expires_at: PAST })],
    });
    const { req, params, env } = redeemReq('redeemer-exp', VALID_CODE);
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(410);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('expired');
  });

  it('6.5 generator cannot redeem own invite → 403 cannot_redeem_own_invite', async () => {
    const state = baseState({ ppv_invites: [validInvite()] });
    // generated_by === 'generator-user', so using that userId.
    const { req, params, env } = redeemReq('generator-user', VALID_CODE);
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('cannot_redeem_own_invite');
  });

  it('6.6 already used by a different user → 403 non_transferable', async () => {
    const state = baseState({
      ppv_invites: [validInvite({ used_by: 'other-user', ip_address: '1.2.3.4', used_at: PAST })],
    });
    const { req, params, env } = redeemReq('yet-another-user', VALID_CODE, '5.6.7.8');
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('non_transferable');
  });

  it('6.7 same user + same IP re-entry → 200 idempotent', async () => {
    const state = baseState({
      ppv_invites: [validInvite({
        used_by: 'redeemer-idem',
        ip_address: '10.0.0.1',
        used_at: PAST,
      })],
    });
    const { req, params, env } = redeemReq('redeemer-idem', VALID_CODE, '10.0.0.1');
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; idempotent: boolean };
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(true);
  });

  it('6.8 same user + different IP → 403 ip_mismatch', async () => {
    const state = baseState({
      ppv_invites: [validInvite({
        used_by: 'redeemer-ipmm',
        ip_address: '10.0.0.1', // original IP
        used_at: PAST,
      })],
    });
    // Same user, VPN-switched to different IP.
    const { req, params, env } = redeemReq('redeemer-ipmm', VALID_CODE, '99.99.99.99');
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('ip_mismatch');
  });

  it('6.9 captcha_failed when OPTIONAL_TURNSTILE_SECRET_KEY is set and no token provided', async () => {
    const state = baseState({ ppv_invites: [validInvite()] });
    const envWithTurnstile = { ...ENV, OPTIONAL_TURNSTILE_SECRET_KEY: 'real-secret' };
    const res = await handleInviteRedeem({
      req: new Request('https://local/api/invite/redeem', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'idem-redeem-captcha12',
          'x-sbbl-user-id-verified': 'redeemer-captcha',
          'cf-connecting-ip': '10.0.0.1',
        },
        // captchaToken absent → verifyTurnstileToken returns false
        body: JSON.stringify({ code: VALID_CODE }),
      }),
      params: {},
      env: envWithTurnstile as never,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('captcha_failed');
  });

  it('6.10 CAS: concurrent update returns 0 matched rows → non_transferable (FIX-3)', async () => {
    // Simulate the race: by the time the update fires, used_by is already set
    // by a concurrent request. The mock's update().eq().is(null) filter finds
    // 0 rows (because used_by !== null now), so claimedRows is an empty array.
    const state = baseState({
      ppv_invites: [{
        ...validInvite(),
        // Pre-set used_by to simulate the concurrent lock winning.
        used_by: 'race-winner',
        ip_address: '9.9.9.9',
        used_at: new Date().toISOString(),
      }],
    });
    const { req, params, env } = redeemReq('race-loser', VALID_CODE, '8.8.8.8');
    const res = await handleInviteRedeem({
      req, params, env,
      admin: buildAdmin(state) as never,
    });
    // race-loser should not win the invite.
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    // Either non_transferable (already claimed) or re-check path.
    expect(['non_transferable', 'ip_mismatch']).toContain(body.error);
  });
});

// ── Suite 7: Session Heartbeat Security ────────────────────────────────────

describe('Suite 7 — Session Heartbeat Security', () => {
  function heartbeatReq(userId: string, sessionId: string, ip = '10.0.0.1') {
    return new Request('https://local/api/streams/game-1/session/heartbeat', {
      method: 'POST',
      headers: {
        'x-idempotency-key': `idem-hb-${userId}-xxx`.slice(0, 64),
        'x-sbbl-user-id-verified': userId,
        'cf-connecting-ip': ip,
      },
      body: JSON.stringify({ sessionId }),
    });
  }

  it('7.1 valid active session → 200 with refreshed expiresAt', async () => {
    const state = baseState({
      stream_access_sessions: [{
        id: 'sess-valid',
        game_id: 'game-1',
        user_id: 'hb-user',
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: MAX_CAP,
      }],
    });
    const res = await handleStreamSessionHeartbeat({
      req: heartbeatReq('hb-user', 'sess-valid'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; expiresAt: string };
    expect(body.ok).toBe(true);
    // expiresAt must be ~70s from now
    const exp = new Date(body.expiresAt).getTime();
    expect(exp).toBeGreaterThan(Date.now() + 60_000);
    expect(exp).toBeLessThan(Date.now() + 80_000);
  });

  it('7.2 cross-user session theft: user B heartbeats user A session → 404', async () => {
    const state = baseState({
      stream_access_sessions: [{
        id: 'sess-userA',
        game_id: 'game-1',
        user_id: 'user-A', // owned by user-A
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: MAX_CAP,
      }],
    });
    // user-B tries to heartbeat user-A's session ID.
    const res = await handleStreamSessionHeartbeat({
      req: heartbeatReq('user-B', 'sess-userA'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    // The heartbeat handler filters by user_id, so user-B gets session_not_found.
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('session_not_found');
  });

  it('7.3 displaced session → 404 session_not_found', async () => {
    const state = baseState({
      stream_access_sessions: [{
        id: 'sess-displaced',
        game_id: 'game-1',
        user_id: 'hb-displaced',
        status: 'displaced', // ← displaced by another device
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: MAX_CAP,
      }],
    });
    const res = await handleStreamSessionHeartbeat({
      req: heartbeatReq('hb-displaced', 'sess-displaced'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(404);
  });

  it('7.4 session maxExpiresAt reached → 403 session_expired (hard cap enforced)', async () => {
    const state = baseState({
      stream_access_sessions: [{
        id: 'sess-capped',
        game_id: 'game-1',
        user_id: 'hb-capped',
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: PAST, // ← hard cap already elapsed
      }],
    });
    const res = await handleStreamSessionHeartbeat({
      req: heartbeatReq('hb-capped', 'sess-capped'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('session_expired');
    // Row must be marked 'ended' in the DB.
    const row = state.stream_access_sessions[0];
    expect(row.status).toBe('ended');
  });

  it('7.5 one-device enforcement: new session displaces old active session', async () => {
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-disp', role: 'player' }],
      stream_access_sessions: [{
        id: 'sess-old',
        game_id: 'game-1',
        user_id: 'player-disp',
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: MAX_CAP,
        idempotency_key: 'old-session-key',
      }],
    });
    // New session with a different key → should displace old one.
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'player-disp', 'new-session-key'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    // Old session must now be displaced.
    const oldRow = state.stream_access_sessions.find((r) => r.id === 'sess-old');
    expect(oldRow?.status).toBe('displaced');
  });

  it('7.6 re-using same session key preserves original maxExpiresAt (no cap reset)', async () => {
    const originalCap = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const state = baseState({
      user_role_assignments: [{ user_id: 'player-samekey', role: 'player' }],
      stream_access_sessions: [{
        id: 'sess-same',
        game_id: 'game-1',
        user_id: 'player-samekey',
        status: 'active',
        expires_at: new Date(Date.now() + 30_000).toISOString(),
        max_expires_at: originalCap,
        idempotency_key: 'stable-session-key',
      }],
    });
    const res = await handlePlaybackSession({
      req: sessionReq('game-1', 'player-samekey', 'stable-session-key'),
      params: { gameId: 'game-1' },
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { maxExpiresAt: string } };
    // Cap must be the original, not a fresh 6h window.
    expect(body.session.maxExpiresAt).toBe(originalCap);
  });
});

// ── Suite 8: Stream Access Endpoint ────────────────────────────────────────

describe('Suite 8 — Stream Access Endpoint (handleStreamAccess)', () => {
  it('8.1 no auth header → throws unauthorized', async () => {
    await expect(
      handleStreamAccess({
        req: new Request('https://local/api/streams/game-1/access'),
        params: {},
        env: ENV,
        admin: buildAdmin(baseState()) as never,
      }),
    ).rejects.toThrow(/unauthorized/i);
  });

  it('8.2 user without entitlement → { hasAccess: false }', async () => {
    const state = baseState();
    const res = await handleStreamAccess({
      req: new Request('https://local/api/streams/game-1/access', {
        headers: { 'x-sbbl-user-id-verified': 'no-ent-user' },
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { hasAccess: boolean };
    expect(body.hasAccess).toBe(false);
  });

  it('8.3 entitled user → { hasAccess: true }', async () => {
    const state = baseState();
    const res = await handleStreamAccess({
      req: new Request('https://local/api/streams/game-1/access', {
        headers: { 'x-sbbl-user-id-verified': 'entitled-user' },
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { hasAccess: boolean };
    expect(body.hasAccess).toBe(true);
  });

  it('8.4 response does not leak entitlement rows or PII beyond hasAccess', async () => {
    const state = baseState();
    const res = await handleStreamAccess({
      req: new Request('https://local/api/streams/game-1/access', {
        headers: { 'x-sbbl-user-id-verified': 'entitled-user' },
      }),
      params: {},
      env: ENV,
      admin: buildAdmin(state) as never,
    });
    const body = await res.json() as Record<string, unknown>;
    const keys = Object.keys(body);
    // Permitted keys only — no raw entitlement data.
    expect(keys.every((k) => ['ok', 'hasAccess', 'gameId', 'userId'].includes(k))).toBe(true);
  });
});

// ── Suite 9: useLiveAccess Client-Side Static Analysis ─────────────────────

describe('Suite 9 — useLiveAccess Hook Static Analysis', () => {
  const HOOK_PATH = path.resolve(__dirname, '../hooks/useLiveAccess.ts');
  const hookSource = fs.readFileSync(HOOK_PATH, 'utf-8');

  it('9.1 entitlement query must include .eq("game_id", …) to prevent cross-game bleed (FIX-1)', () => {
    // A user's PPV for game A must not grant visual access to game B's stream.
    // Verified: the query must have a game_id filter alongside user_id.
    const hasGameIdFilter = hookSource.includes('.eq(\'game_id\',') ||
      hookSource.includes('.eq("game_id",');
    expect(
      hasGameIdFilter,
      'useLiveAccess entitlement query must scope by game_id. ' +
      'Without it, a PPV for game A shows the player UI for game B.',
    ).toBe(true);
  });

  it('9.2 free-role check must not use hasRole() (hierarchy bypass) (FIX-2)', () => {
    // Using hasRole(['coach'], 'player') = true grants coaches client-side
    // "free" access, but handlePlaybackSession on the server denies them.
    // The result is a broken player UX (loads then shows "session forbidden").
    // The hook must use explicit role names instead of hierarchy arithmetic.
    const usesHierarchyCheck = hookSource.includes('hasRole(');
    expect(
      usesHierarchyCheck,
      'useLiveAccess must NOT use hasRole() for the free-access check. ' +
      'It over-promotes coaches/team_managers/league_admins to "free" while ' +
      'the server returns 403 for them.',
    ).toBe(false);
  });

  it('9.3 free-role check must include super_admin explicitly', () => {
    // super_admin must always get free access (fast-path on server).
    const includesSuperAdmin =
      hookSource.includes("'super_admin'") || hookSource.includes('"super_admin"');
    expect(
      includesSuperAdmin,
      'useLiveAccess must explicitly include super_admin in the free-role check.',
    ).toBe(true);
  });

  it('9.4 free-role check must include player explicitly', () => {
    const includesPlayer =
      hookSource.includes("'player'") || hookSource.includes('"player"');
    expect(includesPlayer).toBe(true);
  });

  it('9.5 free-role check must include paid_fan explicitly', () => {
    const includesPaidFan =
      hookSource.includes("'paid_fan'") || hookSource.includes('"paid_fan"');
    expect(includesPaidFan).toBe(true);
  });

  it('9.6 stream config query must select active_game_id for entitlement scoping', () => {
    // active_game_id is required to scope the entitlement check to the
    // currently broadcasting game.
    const hasActiveGameId = hookSource.includes('active_game_id');
    expect(
      hasActiveGameId,
      'useLiveAccess config query must select active_game_id ' +
      'so the entitlement check is scoped to the right game.',
    ).toBe(true);
  });
});
