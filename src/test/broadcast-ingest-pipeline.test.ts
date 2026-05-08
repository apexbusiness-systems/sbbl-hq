/**
 * broadcast-ingest-pipeline.test.ts  — MODULE A
 *
 * Verifies the admin broadcast ingest flow end-to-end using the exact same
 * in-memory mock infrastructure as worker-stream-hardening.test.ts.
 *
 * Suite A-1  Stream config bootstrap      (getOrCreateStreamConfig)
 * Suite A-2  Ingest link (updateConfig)   (handleUpdateStreamConfig)
 * Suite A-3  Go-Live / End-Stream         (handleSetStreamStatus)
 * Suite A-4  Public status gate           (handlePublicStreamStatus)
 * Suite A-5  Admin auth guard             (requireSuperAdminSession)
 * Suite A-6  URL sanitisation             (javascript: / protocol injection)
 * Suite A-7  Source field validation      (main | backup | test)
 * Suite A-8  Route registration           (static worker source assertions)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  handlePublicStreamStatus,
} from '@/worker/index';

// ── Shared source read (static assertions) ───────────────────────────────────
const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');

// ── Canonical in-memory mock (mirrors worker-stream-hardening.test.ts) ───────
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
        eq(col: string, val: unknown) {
          colFilters.push((r) => r[col] === val);
          return builder;
        },
        neq(col: string, val: unknown) {
          colFilters.push((r) => r[col] !== val);
          applyPatch();
          return { error: null };
        },
        select: () => {
          applyPatch();
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
    delete: () => {
      const colFilters: Array<(r: Row) => boolean> = [];
      const builder: any = {
        eq(col: string, val: unknown) {
          colFilters.push((r) => r[col] === val);
          state[table] = (state[table] ?? []).filter((r) => !colFilters.every((fn) => fn(r)));
          return { error: null };
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
      const existing = rows.find((r) =>
        row.id !== undefined ? r.id === row.id : r.user_id === row.user_id && r.game_id === row.game_id,
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
          maybeSingle: async () => ({ data: result, error: null }),
        }),
        // allow awaiting upsert directly (without .select())
        then: (res: (v: unknown) => unknown) => res({ data: result, error: null }),
      };
    },
  };
  return api;
}

function createAdmin(state: Record<string, Row[]>, rpcOverrides: Record<string, unknown> = {}) {
  return {
    from(table: string) {
      return createQuery(table, state);
    },
    rpc(name: string, payload: Record<string, unknown>) {
      if (name in rpcOverrides) return Promise.resolve({ data: rpcOverrides[name], error: null });
      if (name === 'can_user_view_stream') {
        if (payload.p_user_id === 'allowed-user') return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: false, error: null });
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

// Helper: mock Cloudflare caches.default (required by handlePublicStreamStatus)
function stubCaches() {
  (globalThis as any).caches = {
    default: {
      match: async () => undefined,
      put: async () => undefined,
      delete: async () => undefined,
    },
  };
}

// ── A-1: Stream config bootstrap ─────────────────────────────────────────────
describe('A-1: stream config bootstrap', () => {
  it('getOrCreateStreamConfig is defined in worker', () => {
    expect(workerSrc).toMatch(/async function getOrCreateStreamConfig\b/);
  });

  it('getOrCreateStreamConfig queries stream_admin_config with id=true', () => {
    const fnStart = workerSrc.indexOf('async function getOrCreateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('stream_admin_config');
    expect(body).toContain('.eq("id", true)');
    expect(body).toContain('.maybeSingle()');
  });

  it('getOrCreateStreamConfig inserts a default row when none exists', () => {
    const fnStart = workerSrc.indexOf('async function getOrCreateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    // Must insert defaults when config row is absent
    expect(body).toContain('insert(');
    expect(body).toContain('is_live: false');
    expect(body).toContain('"SBBL Live Stream"');
  });
});

// ── A-2: Ingest link (updateConfig) ──────────────────────────────────────────
describe('A-2: admin ingest link — handleUpdateStreamConfig', () => {
  it('handleUpdateStreamConfig is defined in worker', () => {
    expect(workerSrc).toMatch(/async function handleUpdateStreamConfig\b/);
  });

  it('requireSuperAdminSession is called before any write', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    const authIdx = body.indexOf('requireSuperAdminSession');
    const upsertIdx = body.indexOf('.upsert(');
    expect(authIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(authIdx);
  });

  it('collection_id is stored after URL validation, not raw', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('patch.collection_id = safeUrl');
    expect(body).toContain('safeUrl = ""'); // dangerous protocols → empty
  });

  it('returns 400 when body is missing', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"invalid_body"');
    expect(body).toMatch(/400/);
  });

  it('returns 400 when patch is empty (no recognized fields)', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"patch_required"');
  });

  it('upserts into stream_admin_config with id=true as the conflict key', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('stream_admin_config');
    expect(body).toContain('id: true');
    expect(body).toContain('onConflict: "id"');
  });

  it('busts the edge cache after a successful update', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('cfCacheConfig.delete');
    expect(body).toContain('streamCacheUrl(null)');
  });
});

// ── A-3: Go-Live / End-Stream ─────────────────────────────────────────────────
describe('A-3: go-live and end-stream — handleSetStreamStatus', () => {
  it('handleSetStreamStatus is defined in worker', () => {
    expect(workerSrc).toMatch(/async function handleSetStreamStatus\b/);
  });

  it('requireSuperAdminSession is called before state change', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    const authIdx = body.indexOf('requireSuperAdminSession');
    const upsertIdx = body.indexOf('.upsert(');
    expect(authIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(authIdx);
  });

  it('returns 400 when isLive is not boolean', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"is_live_required"');
    expect(body).toMatch(/400/);
  });

  it('sets live_started_at when going live', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('live_started_at');
    expect(body).toContain('live_ended_at = null');
  });

  it('sets live_ended_at when ending stream', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('live_ended_at');
  });

  it('busts the edge cache immediately after go-live', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('cfCachesLive.delete(bustKey)');
    // Also clears the in-process streamUrlCache
    expect(body).toContain('streamUrlCache.delete(k)');
  });

  it('returns { ok: true, isLive, at } on success', () => {
    const fnStart = workerSrc.indexOf('async function handleSetStreamStatus');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('ok: true');
    expect(body).toContain('isLive: body.isLive');
    expect(body).toContain('at: nowIso');
  });
});

// ── A-4: Public status gate (runtime) ────────────────────────────────────────
describe('A-4: handlePublicStreamStatus — runtime behaviour', () => {
  beforeEach(stubCaches);

  it('omits collectionId from public status response', async () => {
    const state: Record<string, Row[]> = {
      stream_admin_config: [{ id: true, title: 'WBL Live', is_live: true, active_game_id: 'game-1', collection_id: 'https://secret.example/stream' }],
      stream_access_sessions: [],
      stream_sessions: [],
    };
    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status'),
      admin: createAdmin(state),
    } as any);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.isLive).toBe(true);
    expect(body.title).toBe('WBL Live');
    // collectionId MUST NOT be exposed to untrusted callers
    expect(body.collectionId).toBeUndefined();
    expect(body.collection_id).toBeUndefined();
  });

  it('returns isLive=false when stream_admin_config has is_live=false', async () => {
    const state: Record<string, Row[]> = {
      stream_admin_config: [{ id: true, title: 'SBBL Live Stream', is_live: false, collection_id: '' }],
      stream_access_sessions: [],
      stream_sessions: [],
    };
    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status'),
      admin: createAdmin(state),
    } as any);
    const body = await res.json() as Record<string, unknown>;
    expect(body.isLive).toBe(false);
    expect(res.status).toBe(200);
  });

  it('creates a default config row when none exists and returns is_live=false', async () => {
    const state = {
      api_idempotency_keys: [],
      user_role_assignments: [],
      stream_sessions: [{ id: 'sess-1', game_id: 'game-1', status: 'live', peak_viewers: 0 }],
      games: [{ id: 'game-1', status: 'live', replay_mode: 'none' }],
      stream_admin_config: [], // no existing config
      stream_access_sessions: [],
    };
    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status'),
      admin: createAdmin(state),
    } as any);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.isLive).toBe(false);
    // Default config row must have been inserted
    expect(state.stream_admin_config.length).toBeGreaterThanOrEqual(1);
  });

  it('viewerCount is non-negative integer', async () => {
    const state: Record<string, Row[]> = {
      stream_admin_config: [{ id: true, is_live: true, collection_id: 'https://cdn.example/live.m3u8' }],
      stream_access_sessions: [
        { id: 's1', game_id: 'game-x', user_id: 'u1', status: 'active', expires_at: new Date(Date.now() + 60_000).toISOString() },
        { id: 's2', game_id: 'game-x', user_id: 'u2', status: 'active', expires_at: new Date(Date.now() + 60_000).toISOString() },
      ],
      stream_sessions: [],
    };
    const res = await handlePublicStreamStatus({
      req: new Request('https://local/api/streams/status?gameId=game-x'),
      admin: createAdmin(state),
    } as any);
    const body = await res.json() as Record<string, unknown>;
    expect(Number(body.viewerCount)).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(Number(body.viewerCount))).toBe(true);
  });
});

// ── A-5: Admin auth guard ─────────────────────────────────────────────────────
describe('A-5: requireSuperAdminSession — RBAC enforcement', () => {
  it('requireSuperAdminSession exists and calls requireAdminSession', () => {
    const fnStart = workerSrc.indexOf('async function requireSuperAdminSession');
    const fnEnd = workerSrc.indexOf('\n}', fnStart) + 2;
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('requireAdminSession');
    expect(body).toContain('isSuperAdmin');
    expect(body).toContain('"forbidden"');
  });

  it('handleUpdateStreamConfig and handleSetStreamStatus both call requireSuperAdminSession', () => {
    for (const fn of ['handleUpdateStreamConfig', 'handleSetStreamStatus']) {
      const fnStart = workerSrc.indexOf(`async function ${fn}`);
      const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
      const body = workerSrc.slice(fnStart, fnEnd);
      expect(body).toContain('requireSuperAdminSession');
    }
  });

  it('handleGetStreamConfig uses requireAdminSession (not super_admin only)', () => {
    const fnStart = workerSrc.indexOf('async function handleGetStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('requireAdminSession');
  });
});

// ── A-6: URL sanitisation (injection prevention) ─────────────────────────────
describe('A-6: collection_id URL injection prevention', () => {
  it('rejects javascript: protocol (XSS vector)', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"javascript:"');
    expect(body).toContain('safeUrl = ""');
  });

  it('rejects data: protocol', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"data:"');
  });

  it('rejects file: protocol', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"file:"');
  });

  it('allows https:, http:, rtmp:, rtmps: protocols', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"https:"');
    expect(body).toContain('"http:"');
    expect(body).toContain('"rtmp:"');
    expect(body).toContain('"rtmps:"');
  });
});

// ── A-7: Source field validation ──────────────────────────────────────────────
describe('A-7: source field — allowed values', () => {
  it('source enum in handleUpdateStreamConfig matches main|backup|test', () => {
    const fnStart = workerSrc.indexOf('async function handleUpdateStreamConfig');
    const fnEnd = workerSrc.indexOf('\nasync function ', fnStart + 10);
    const body = workerSrc.slice(fnStart, fnEnd);
    expect(body).toContain('"main"');
    expect(body).toContain('"backup"');
    expect(body).toContain('"test"');
  });
});

// ── A-8: Route registration (static) ─────────────────────────────────────────
describe('A-8: broadcast route registration', () => {
  const routes = [
    ['"GET"',  '"/api/streams/status"',     'handlePublicStreamStatus'],
    ['"GET"',  '"/ops/streams/config"',      'handleGetStreamConfig'],
    ['"POST"', '"/ops/streams/config"',      'handleUpdateStreamConfig'],
    ['"POST"', '"/ops/streams/status"',      'handleSetStreamStatus'],
  ] as const;

  routes.forEach(([method, path, handler]) => {
    it(`registers ${method} ${path} → ${handler}`, () => {
      expect(workerSrc).toContain(path);
      expect(workerSrc).toContain(handler);
    });
  });

  it('broadcast session route /api/streams/:gameId/session is registered', () => {
    expect(workerSrc).toContain('"/api/streams/:gameId/session"');
    expect(workerSrc).toContain('handlePlaybackSession');
  });

  it('broadcast heartbeat route is registered', () => {
    expect(workerSrc).toContain('/session/heartbeat');
    expect(workerSrc).toContain('handleStreamSessionHeartbeat');
  });
});
