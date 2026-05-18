/**
 * Armageddon Stream Invariants — adversarial invariant probes.
 *
 * Enforcement layer 4 of the Stream Independence Contract.
 * See docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md
 *
 * These tests validate the CURRENT (Stage 0 baseline) invariants and
 * guard against regressions as the migration progresses to Stage 6:
 *
 * INV-1  Worker proxies the stream URL — clients never receive the raw
 *        collection_id / origin stream URL.
 * INV-2  Unauthorized viewers are denied regardless of game state.
 * INV-3  Public stream status never exposes the raw collection_id.
 * INV-4  No migration created after the contract date (2026-04-17)
 *        introduces a `game_id … NOT NULL` constraint on
 *        streams, stream_assignments, or stream_entitlements.
 * INV-5  Worker source never sends games.stream_url as the direct
 *        playback URL to the client — it always goes through the proxy.
 * INV-6  Playback session uses can_user_view_stream RPC for access
 *        control (not a raw table scan).
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  handlePlaybackSession,
  handlePublicStreamStatus,
} from '@/worker/index';

// ── Shared test helpers ─────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function buildAdmin(
  state: Record<string, Row[]>,
  rpcOverrides: Record<string, unknown> = {},
) {
  function makeQuery(table: string) {
    const localFilters: Array<(row: Row) => boolean> = [];
    const api: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        localFilters.push((r) => r[col] === val);
        return api;
      },
      is(col: string, val: unknown) {
        localFilters.push((r) => r[col] === val);
        return api;
      },
      neq(col: string, val: unknown) {
        localFilters.push((r) => r[col] !== val);
        return api;
      },
      order() { return api; },
      limit() { return api; },
      select() { return api; },
      maybeSingle: async () => {
        const rows = (state[table] ?? []).filter((r) =>
          localFilters.every((fn) => fn(r)),
        );
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = (state[table] ?? []).filter((r) =>
          localFilters.every((fn) => fn(r)),
        );
        return rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'not_found' } };
      },
      then: async (resolve: (v: unknown) => unknown) => {
        const rows = (state[table] ?? []).filter((r) =>
          localFilters.every((fn) => fn(r)),
        );
        return resolve({ data: rows, error: null });
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
      upsert: (row: Row) => {
        const rows = state[table] ?? [];
        const existing = rows.find(
          (r) =>
            r.user_id === row.user_id &&
            (r.game_id === row.game_id || (!r.game_id && !row.game_id)) &&
            r.idempotency_key === row.idempotency_key,
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
      update: (patch: Row) => {
        const colFilters: Array<(r: Row) => boolean> = [];
        const applyPatch = () => {
          (state[table] ?? []).forEach((r) => {
            if (colFilters.every((fn) => fn(r))) Object.assign(r, patch);
          });
        };
        const builder: Record<string, unknown> = {
          eq(col: string, val: unknown) {
            colFilters.push((r) => r[col] === val);
            return builder;
          },
          neq(col: string, val: unknown) {
            colFilters.push((r) => r[col] !== val);
            applyPatch();
            return { error: null };
          },
          select() {
            applyPatch();
            const target = (state[table] ?? []).find((r) =>
              colFilters.every((fn) => fn(r)),
            );
            return {
              maybeSingle: async () => ({ data: target ?? null, error: null }),
              single: async () => ({
                data: target ?? null,
                error: target ? null : { message: 'not_found' },
              }),
            };
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
        const allowed = payload.p_user_id === 'entitled-user';
        return { data: allowed, error: null };
      }
      if (name === 'consume_stream_rate_limit') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
  };
}

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 'resend_test',
  // Required so resolveProxyTokenSecret returns a value on the proxy delivery path.
  OMNIHUB_SIGNING_SECRET: 'test-omnihub-signing-secret',
} as unknown as Parameters<typeof handlePlaybackSession>[0]['env'];

// ── INV-1 & INV-5: URL Proxy Invariant ─────────────────────────────────────

describe('INV-1/INV-5: playback URL is always proxied', () => {
  it('returns a /api/streams/.../proxy/... URL, never the raw origin', async () => {
    const rawOriginUrl = 'https://secret-origin.cdn.example/live.m3u8';
    const state: Record<string, Row[]> = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-proxy', status: 'live' }],
      stream_admin_config: [
        {
          id: true,
          collection_id: rawOriginUrl,
          title: 'Live',
          is_live: true,
        },
      ],
      stream_access_sessions: [],
    };

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-proxy/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'inv1-key-111111111',
          'x-sbbl-user-id-verified': 'entitled-user',
        },
        body: JSON.stringify({ sessionKey: 'inv1-session-key' }),
      }),
      params: { gameId: 'game-proxy' },
      env: ENV,
      admin: buildAdmin(state) as unknown as Parameters<typeof handlePlaybackSession>[0]['admin'],
    } as Parameters<typeof handlePlaybackSession>[0]);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, { url?: string }>;
    const returnedUrl = body.playback?.url ?? '';

    // Contract: client never receives the raw origin URL
    expect(returnedUrl).not.toContain('secret-origin.cdn.example');
    expect(returnedUrl).not.toBe(rawOriginUrl);

    // Contract: URL must be a local proxy path
    expect(returnedUrl).toMatch(/\/api\/streams\//);
    expect(returnedUrl).toMatch(/\/proxy\//);
  });
});

// ── INV-2: Unauthorized Access Denial ───────────────────────────────────────

describe('INV-2: unauthorized viewers are denied', () => {
  it('rejects a user with no entitlement (403)', async () => {
    const state: Record<string, Row[]> = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-deny', status: 'live' }],
      stream_admin_config: [
        {
          id: true,
          collection_id: 'https://cdn.example/live.m3u8',
          is_live: true,
        },
      ],
      stream_access_sessions: [],
    };

    const res = await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-deny/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'inv2-key-222222222',
          'x-sbbl-user-id-verified': 'no-entitlement-user',
        },
        body: JSON.stringify({ sessionKey: 'inv2-session-key' }),
      }),
      params: { gameId: 'game-deny' },
      env: ENV,
      admin: buildAdmin(state) as unknown as Parameters<typeof handlePlaybackSession>[0]['admin'],
    } as Parameters<typeof handlePlaybackSession>[0]);

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
  });

  it('rejects a request with no user identity header (throws unauthorized)', async () => {
    const state: Record<string, Row[]> = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-noauth', status: 'live' }],
      stream_admin_config: [
        { id: true, collection_id: 'https://cdn.example/live.m3u8', is_live: true },
      ],
      stream_access_sessions: [],
    };

    // Worker throws rather than returning a response when auth header is absent.
    // This is correct — the fetch handler wraps it into a 401; the outer error
    // boundary never surfaces raw stream URLs to unauthenticated callers.
    await expect(
      handlePlaybackSession({
        req: new Request('https://local/api/streams/game-noauth/session', {
          method: 'POST',
          headers: { 'x-idempotency-key': 'inv2-key-333333333' },
          body: JSON.stringify({ sessionKey: 'inv2-session-noauth' }),
        }),
        params: { gameId: 'game-noauth' },
        env: ENV,
        admin: buildAdmin(state) as unknown as Parameters<typeof handlePlaybackSession>[0]['admin'],
      } as Parameters<typeof handlePlaybackSession>[0]),
    ).rejects.toThrow(/unauthorized/i);
  });
});

// ── INV-3: Public Status Does Not Expose collection_id ──────────────────────

describe('INV-3: public stream status never exposes collection_id', () => {
  it('omits collection_id and raw origin from public status response', async () => {
    (
      globalThis as unknown as {
        caches: {
          default: {
            match: (r: Request) => Promise<Response | undefined>;
            put: () => Promise<void>;
          };
        };
      }
    ).caches = {
      default: {
        match: async () => undefined,
        put: async () => undefined,
      },
    };

    const state: Record<string, Row[]> = {
      stream_admin_config: [
        {
          id: true,
          title: 'Game Night',
          is_live: true,
          active_game_id: 'game-pub',
          collection_id: 'https://secret-stream-origin.example/live',
        },
      ],
      stream_access_sessions: [],
      stream_sessions: [
        {
          id: 'sess-pub',
          game_id: 'game-pub',
          status: 'live',
          peak_viewers: 0,
          current_viewers: 0,
        },
      ],
    };

    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status'),
      admin: buildAdmin(state) as unknown as Parameters<typeof handlePublicStreamStatus>[0]['admin'],
    } as Parameters<typeof handlePublicStreamStatus>[0]);

    const body = await res.json() as Record<string, unknown>;

    // Contract: raw stream origin must never leak to public
    expect(body.collectionId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('secret-stream-origin');
  });
});

// ── INV-4: Migration Scan — No Forbidden NOT NULL After Contract Date ────────

describe('INV-4: no post-contract migration adds game_id NOT NULL on stream tables', () => {
  const CONTRACT_DATE = '20260417'; // 2026-04-17
  const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
  const FORBIDDEN_TABLES = [
    'streams',
    'stream_assignments',
    'stream_entitlements',
    'stream_playback_tokens',
  ];

  it('scans all post-contract migrations for forbidden NOT NULL game_id patterns', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => {
      const timestamp = f.split('_')[0];
      return (
        f.endsWith('.sql') &&
        timestamp.length >= 8 &&
        timestamp >= CONTRACT_DATE
      );
    });

    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(
        path.join(MIGRATIONS_DIR, file),
        'utf-8',
      );

      // Split into individual DDL statements to prevent cross-statement
      // greedy matching that produces false positives.
      const statements = content.split(';');

      for (const stmt of statements) {
        const lower = stmt.toLowerCase().replace(/\s+/g, ' ');

        for (const table of FORBIDDEN_TABLES) {
          // Pattern 1: ALTER TABLE <table> ADD COLUMN game_id ... NOT NULL
          // Must appear in the same statement (no ; boundaries).
          const addColPattern = new RegExp(
            `alter\\s+table\\s+\\S*${table}\\b.{0,400}add\\s+column\\s+(if\\s+not\\s+exists\\s+)?game_id[^)]{0,200}not\\s+null`,
          );
          if (addColPattern.test(lower)) {
            violations.push(
              `${file}: ALTER TABLE ${table} ADD COLUMN game_id ... NOT NULL (FORBIDDEN by Stream Independence Contract)`,
            );
          }

          // Pattern 2: ALTER TABLE <table> ALTER COLUMN game_id SET NOT NULL
          const setNotNullPattern = new RegExp(
            `alter\\s+table\\s+\\S*${table}\\b.{0,200}alter\\s+column\\s+game_id\\s+set\\s+not\\s+null`,
          );
          if (setNotNullPattern.test(lower)) {
            violations.push(
              `${file}: ALTER TABLE ${table} ALTER COLUMN game_id SET NOT NULL (FORBIDDEN by Stream Independence Contract)`,
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Stream Independence Contract violated in migrations:\n${violations.join('\n')}`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});

// ── INV-6: Access Control Uses RPC, Not Raw Table Scan ───────────────────────

describe('INV-6: access control uses can_user_view_stream RPC', () => {
  it('tracks which RPC was called for access decisions', async () => {
    const rpcCalls: string[] = [];
    const baseState: Record<string, Row[]> = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      games: [{ id: 'game-rpc', status: 'live' }],
      stream_admin_config: [
        {
          id: true,
          collection_id: 'https://cdn.example/rpc-test.m3u8',
          is_live: true,
        },
      ],
      stream_access_sessions: [],
    };

    const baseAdmin = buildAdmin(baseState);
    const trackingAdmin = {
      from: (table: string) => baseAdmin.from(table),
      rpc: async (name: string, payload: Record<string, unknown>) => {
        rpcCalls.push(name);
        return baseAdmin.rpc(name, payload);
      },
    };

    await handlePlaybackSession({
      req: new Request('https://local/api/streams/game-rpc/session', {
        method: 'POST',
        headers: {
          'x-idempotency-key': 'inv6-key-666666666',
          'x-sbbl-user-id-verified': 'entitled-user',
        },
        body: JSON.stringify({ sessionKey: 'inv6-session-key' }),
      }),
      params: { gameId: 'game-rpc' },
      env: ENV,
      admin: trackingAdmin as unknown as Parameters<typeof handlePlaybackSession>[0]['admin'],
    } as Parameters<typeof handlePlaybackSession>[0]);

    // Contract: access decision must be made via the RPC, not a raw query
    const accessRpcCalled = rpcCalls.some((name) =>
      name.startsWith('can_user_view_stream'),
    );
    expect(accessRpcCalled).toBe(true);
  });
});
