/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Worker highlights + reaction-aggregate routes.
 *
 * Static verification PLUS functional integration: every handler runs against
 * an in-memory Supabase mock, so we prove the exact response shape and
 * guardrails (UUID validation, admin gate, window clamp, error mapping).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  handlePublicHighlights,
  handleMarkHighlight,
  handleDeleteHighlight,
  handleUpdateHighlight,
  handleReactionAggregate,
} from '@/worker/routes/highlights';

const workerSource = readFileSync(
  resolve(__dirname, '../worker/index.ts'),
  'utf-8',
);
const highlightsSource = readFileSync(
  resolve(__dirname, '../worker/routes/highlights.ts'),
  'utf-8',
);

const GAME_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const BAD_ID = 'not-a-uuid';
const ADMIN_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

type Row = Record<string, unknown>;

// In-memory Supabase mock — mirrors the pattern from worker-stream-hardening.test.ts
function createQuery(table: string, state: Record<string, Row[]>) {
  const filters: Array<(row: Row) => boolean> = [];
  const api: any = {
    eq(col: string, val: unknown) {
      filters.push((r) => r[col] === val);
      return api;
    },
    order() {
      return api;
    },
    limit() {
      return api;
    },
    maybeSingle: async () => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      if (!rows[0]) return { data: null, error: { message: 'not_found' } };
      return { data: rows[0], error: null };
    },
    then: async (resolveFn: (value: unknown) => unknown) => {
      const rows = (state[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return resolveFn({ data: rows, error: null });
    },
    select: () => api,
    insert: (row: Row) => {
      const normalized = { ...row, id: row.id ?? crypto.randomUUID() };
      state[table] = [...(state[table] ?? []), normalized];
      return {
        select: () => ({
          single: async () => ({ data: normalized, error: null }),
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
      const builder: any = {
        eq(col: string, val: unknown) {
          colFilters.push((r) => r[col] === val);
          return builder;
        },
        select: () => {
          applyPatch();
          const rows = state[table] ?? [];
          const target = rows.find((r) => colFilters.every((fn) => fn(r)));
          return {
            single: async () => ({
              data: target ?? null,
              error: target ? null : { message: 'not_found' },
            }),
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

function createAdmin(
  state: Record<string, Row[]>,
  rpcHandler?: (name: string, payload: Record<string, unknown>) => unknown,
) {
  return {
    from(table: string) {
      return createQuery(table, state);
    },
    rpc(name: string, payload: Record<string, unknown>) {
      if (rpcHandler) return Promise.resolve(rpcHandler(name, payload));
      return Promise.resolve({ data: null, error: null });
    },
  } as any;
}

function mkCtx(options: {
  url: string;
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  admin: any;
}) {
  const init: RequestInit = { method: options.method ?? 'GET' };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
  } else if (options.headers) {
    init.headers = options.headers;
  }
  return {
    req: new Request(options.url, init),
    admin: options.admin,
    params: options.params ?? {},
    env: {} as any,
  } as any;
}

// ── Static route-table wiring ─────────────────────────────────────────────
describe('highlights routes (static wiring)', () => {
  it('registers public + admin highlights paths', () => {
    for (const path of [
      '/api/public/highlights/:gameId',
      '/api/public/streams/:gameId/reactions/aggregate',
      '/api/ops/highlights/mark',
      '/api/ops/highlights/:id',
      '/api/ops/highlights/:id/delete',
    ]) {
      expect(workerSource).toContain(`"${path}"`);
    }
  });

  it('imports every handler from ./routes/highlights', () => {
    for (const name of [
      'handlePublicHighlights',
      'handleMarkHighlight',
      'handleDeleteHighlight',
      'handleUpdateHighlight',
      'handleReactionAggregate',
    ]) {
      expect(workerSource).toContain(name);
      expect(highlightsSource).toMatch(new RegExp(`export async function ${name}`));
    }
  });

  it('admin guard uses the canonical 4-role set (mirrors overlay.ts)', () => {
    expect(highlightsSource).toContain('"super_admin"');
    expect(highlightsSource).toContain('"league_admin"');
    expect(highlightsSource).toContain('"team_manager"');
    expect(highlightsSource).toContain('"media_operator"');
    expect(highlightsSource).not.toContain('"ops_admin"');
  });

  it('public highlights endpoint is cache-controlled', () => {
    expect(highlightsSource).toMatch(/s-maxage=10/);
  });

  it('reaction aggregate uses the RPC', () => {
    expect(highlightsSource).toContain('get_reaction_aggregate');
  });
});

// ── handlePublicHighlights ───────────────────────────────────────────────
describe('handlePublicHighlights', () => {
  it('rejects invalid UUID with 400', async () => {
    const res = await handlePublicHighlights(
      mkCtx({
        url: `https://local/api/public/highlights/${BAD_ID}`,
        params: { gameId: BAD_ID },
        admin: createAdmin({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body).toEqual({ ok: false, error: 'invalid_game_id' });
  });

  it('returns cached list for valid gameId', async () => {
    const state: Record<string, Row[]> = {
      highlight_clips: [
        {
          id: 'h1',
          game_id: GAME_ID,
          title: 'Buzzer beater',
          occurred_at: new Date().toISOString(),
        },
      ],
    };
    const res = await handlePublicHighlights(
      mkCtx({
        url: `https://local/api/public/highlights/${GAME_ID}`,
        params: { gameId: GAME_ID },
        admin: createAdmin(state),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=10');
    const body = (await res.json()) as { ok: boolean; data: Row[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Buzzer beater');
  });

  it('returns empty array when no rows — never fixtures', async () => {
    const res = await handlePublicHighlights(
      mkCtx({
        url: `https://local/api/public/highlights/${GAME_ID}`,
        params: { gameId: GAME_ID },
        admin: createAdmin({ highlight_clips: [] }),
      }),
    );
    const body = (await res.json()) as { ok: boolean; data: Row[] };
    expect(body.data).toEqual([]);
  });
});

// ── handleMarkHighlight ──────────────────────────────────────────────────
describe('handleMarkHighlight', () => {
  it('rejects unauthenticated callers', async () => {
    const state = { user_role_assignments: [] };
    await expect(() =>
      handleMarkHighlight(
        mkCtx({
          url: 'https://local/api/ops/highlights/mark',
          method: 'POST',
          body: { game_id: GAME_ID },
          admin: createAdmin(state),
        }),
      ),
    ).rejects.toThrow(/unauthorized/);
  });

  it('rejects callers without admin role', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'player' }],
    };
    await expect(() =>
      handleMarkHighlight(
        mkCtx({
          url: 'https://local/api/ops/highlights/mark',
          method: 'POST',
          body: { game_id: GAME_ID },
          headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
          admin: createAdmin(state),
        }),
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it('snapshots overlay state onto the inserted row', async () => {
    const state: Record<string, Row[]> = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'media_operator' }],
      overlay_game_state: [
        {
          game_id: GAME_ID,
          period: 3,
          clock_seconds: 123,
          home_score: 55,
          away_score: 60,
        },
      ],
      highlight_clips: [],
    };
    const res = await handleMarkHighlight(
      mkCtx({
        url: 'https://local/api/ops/highlights/mark',
        method: 'POST',
        body: { game_id: GAME_ID, title: 'Steal + dunk' },
        headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
        admin: createAdmin(state),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; highlight: Row };
    expect(body.ok).toBe(true);
    expect(body.highlight).toMatchObject({
      game_id: GAME_ID,
      kind: 'manual',
      period: 3,
      clock_seconds: 123,
      home_score: 55,
      away_score: 60,
      title: 'Steal + dunk',
      created_by: ADMIN_ID,
    });
    expect(state.highlight_clips).toHaveLength(1);
  });

  it('rejects invalid gameId body', async () => {
    const state = {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'super_admin' }],
    };
    const res = await handleMarkHighlight(
      mkCtx({
        url: 'https://local/api/ops/highlights/mark',
        method: 'POST',
        body: { game_id: BAD_ID },
        headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
        admin: createAdmin(state),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe('invalid_game_id');
  });
});

// ── handleUpdateHighlight + handleDeleteHighlight ────────────────────────
describe('handleUpdateHighlight + handleDeleteHighlight', () => {
  const HIGHLIGHT_ID = 'cccccccc-3333-4333-8333-333333333333';

  function seedState() {
    return {
      user_role_assignments: [{ user_id: ADMIN_ID, role: 'league_admin' }],
      highlight_clips: [
        {
          id: HIGHLIGHT_ID,
          game_id: GAME_ID,
          title: 'Old title',
          media_url: null,
        },
      ],
    } as Record<string, Row[]>;
  }

  it('update only accepts whitelisted fields', async () => {
    const state = seedState();
    const res = await handleUpdateHighlight(
      mkCtx({
        url: `https://local/api/ops/highlights/${HIGHLIGHT_ID}`,
        method: 'POST',
        body: {
          title: 'New title',
          media_url: 'https://cdn.example/c.mp4',
          // Rogue attempt — must not be applied.
          game_id: 'zzzzzzzz-9999-4999-8999-999999999999',
        },
        params: { id: HIGHLIGHT_ID },
        headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
        admin: createAdmin(state),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; highlight: Row };
    expect(body.highlight.title).toBe('New title');
    expect(body.highlight.media_url).toBe('https://cdn.example/c.mp4');
    // game_id must not have mutated
    expect(body.highlight.game_id).toBe(GAME_ID);
  });

  it('delete rejects invalid id', async () => {
    const res = await handleDeleteHighlight(
      mkCtx({
        url: `https://local/api/ops/highlights/${BAD_ID}/delete`,
        method: 'POST',
        params: { id: BAD_ID },
        headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
        admin: createAdmin(seedState()),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('delete removes the row', async () => {
    const state = seedState();
    const res = await handleDeleteHighlight(
      mkCtx({
        url: `https://local/api/ops/highlights/${HIGHLIGHT_ID}/delete`,
        method: 'POST',
        params: { id: HIGHLIGHT_ID },
        headers: { 'x-sbbl-user-id-verified': ADMIN_ID },
        admin: createAdmin(state),
      }),
    );
    expect(res.status).toBe(200);
    expect(state.highlight_clips).toHaveLength(0);
  });
});

// ── handleReactionAggregate ──────────────────────────────────────────────
describe('handleReactionAggregate', () => {
  it('rejects invalid UUID', async () => {
    const res = await handleReactionAggregate(
      mkCtx({
        url: `https://local/api/public/streams/${BAD_ID}/reactions/aggregate`,
        params: { gameId: BAD_ID },
        admin: createAdmin({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('calls RPC with clamped window (upper bound)', async () => {
    let rpcPayload: Record<string, unknown> | null = null;
    const admin = createAdmin({}, (name, payload) => {
      rpcPayload = { name, ...payload };
      return { data: [{ reaction_type: 'fire', count: 42 }], error: null };
    });
    const res = await handleReactionAggregate(
      mkCtx({
        url: `https://local/api/public/streams/${GAME_ID}/reactions/aggregate?window=99999`,
        params: { gameId: GAME_ID },
        admin,
      }),
    );
    expect(res.status).toBe(200);
    expect(rpcPayload).not.toBeNull();
    expect(rpcPayload!.name).toBe('get_reaction_aggregate');
    expect(rpcPayload!.p_game_id).toBe(GAME_ID);
    expect(rpcPayload!.p_window_seconds).toBe(300);
  });

  it('calls RPC with clamped window (lower bound)', async () => {
    let rpcPayload: Record<string, unknown> | null = null;
    const admin = createAdmin({}, (name, payload) => {
      rpcPayload = { name, ...payload };
      return { data: [], error: null };
    });
    await handleReactionAggregate(
      mkCtx({
        url: `https://local/api/public/streams/${GAME_ID}/reactions/aggregate?window=1`,
        params: { gameId: GAME_ID },
        admin,
      }),
    );
    expect(rpcPayload!.p_window_seconds).toBe(5);
  });

  it('defaults to 30 s when window missing', async () => {
    let rpcPayload: Record<string, unknown> | null = null;
    const admin = createAdmin({}, (name, payload) => {
      rpcPayload = { name, ...payload };
      return { data: [], error: null };
    });
    await handleReactionAggregate(
      mkCtx({
        url: `https://local/api/public/streams/${GAME_ID}/reactions/aggregate`,
        params: { gameId: GAME_ID },
        admin,
      }),
    );
    expect(rpcPayload!.p_window_seconds).toBe(30);
  });

  it('returns RPC data and short edge cache', async () => {
    const admin = createAdmin({}, () => ({
      data: [
        { reaction_type: 'fire', count: 10 },
        { reaction_type: 'heart', count: 7 },
      ],
      error: null,
    }));
    const res = await handleReactionAggregate(
      mkCtx({
        url: `https://local/api/public/streams/${GAME_ID}/reactions/aggregate?window=30`,
        params: { gameId: GAME_ID },
        admin,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=2');
    const body = (await res.json()) as {
      ok: boolean;
      data: Array<{ reaction_type: string; count: number }>;
    };
    expect(body.data).toEqual([
      { reaction_type: 'fire', count: 10 },
      { reaction_type: 'heart', count: 7 },
    ]);
  });
});
