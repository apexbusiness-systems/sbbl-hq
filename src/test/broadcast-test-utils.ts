import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
export type TestState = Record<string, Row[]>;

type RpcOverride = (payload: Row) => Promise<{ data: unknown; error: { message: string } | null }> | { data: unknown; error: { message: string } | null };
type QueryResponse<T> = { data: T; error: { message: string } | null };
type MaybeSingleBuilder = {
  maybeSingle: () => Promise<QueryResponse<Row | null>>;
  single: () => Promise<QueryResponse<Row | null>>;
};
type UpdateBuilder = {
  eq: (col: string, value: unknown) => UpdateBuilder;
  is: (col: string, value: unknown) => UpdateBuilder;
  neq: (col: string, value: unknown) => { error: null };
  select: () => MaybeSingleBuilder;
};
type QueryApi = {
  eq: (col: string, value: unknown) => QueryApi;
  is: (col: string, value: unknown) => QueryApi;
  neq: (col: string, value: unknown) => QueryApi;
  gt: (col: string, value: unknown) => QueryApi;
  in: (col: string, values: unknown[]) => QueryApi;
  order: () => QueryApi;
  limit: () => QueryApi;
  select: () => QueryApi;
  maybeSingle: () => Promise<QueryResponse<Row | null>>;
  single: () => Promise<QueryResponse<Row | null>>;
  then: (resolve: (value: QueryResponse<Row[]>) => unknown) => Promise<unknown>;
  insert: (row: Row) => { select?: () => { single: () => Promise<QueryResponse<Row>> }; error: null };
  update: (patch: Row) => UpdateBuilder;
  upsert: (row: Row) => { select: () => { single: () => Promise<QueryResponse<Row | null>> } };
};

export const testEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-with-enough-length-for-tests',
  VITE_STREAM_URL: 'https://cdn.example.com/live/default.m3u8',
  OMNIHUB_SIGNING_SECRET: 'test-signing-secret',
} as unknown as Env;

function rowMatches(row: Row, filters: Array<(row: Row) => boolean>) {
  return filters.every((fn) => fn(row));
}

export function createAdmin(
  state: TestState,
  options: { upsertErrorTable?: string; rpc?: Record<string, RpcOverride> } = {},
): SupabaseClient {
  function query(table: string): QueryApi {
    const filters: Array<(row: Row) => boolean> = [];
    const api: QueryApi = {
      eq(col, value) { filters.push((row) => row[col] === value); return api; },
      is(col, value) { filters.push((row) => (value === null ? row[col] == null : row[col] === value)); return api; },
      neq(col, value) { filters.push((row) => row[col] !== value); return api; },
      gt(col, value) { filters.push((row) => String(row[col]) > String(value)); return api; },
      in(col, values) { filters.push((row) => values.includes(row[col])); return api; },
      order() { return api; },
      limit() { return api; },
      select() { return api; },
      maybeSingle: async () => ({ data: (state[table] ?? []).find((row) => rowMatches(row, filters)) ?? null, error: null }),
      single: async () => {
        const row = (state[table] ?? []).find((item) => rowMatches(item, filters));
        return row ? { data: row, error: null } : { data: null, error: { message: 'not_found' } };
      },
      then: async (resolve) => resolve({ data: (state[table] ?? []).filter((row) => rowMatches(row, filters)), error: null }),
      insert(row) {
        if (table === 'api_idempotency_keys') return { error: null };
        const normalized = { ...row, id: row.id ?? crypto.randomUUID(), code: row.code ?? crypto.randomUUID() };
        state[table] = [...(state[table] ?? []), normalized];
        return { select: () => ({ single: async () => ({ data: normalized, error: null }) }), error: null };
      },
      update(patch) {
        const updateFilters = [...filters];
        const applyPatch = () => {
          (state[table] ?? []).forEach((row) => {
            if (rowMatches(row, updateFilters)) Object.assign(row, patch);
          });
        };
        const builder: UpdateBuilder = {
          eq(col, value) { updateFilters.push((row) => row[col] === value); return builder; },
          is(col, value) { updateFilters.push((row) => (value === null ? row[col] == null : row[col] === value)); return builder; },
          neq(col, value) {
            updateFilters.push((row) => row[col] !== value);
            applyPatch();
            return { error: null };
          },
          select: () => {
            applyPatch();
            const row = (state[table] ?? []).find((item) => rowMatches(item, updateFilters));
            return {
              maybeSingle: async () => ({ data: row ?? null, error: null }),
              single: async () => ({ data: row ?? null, error: row ? null : { message: 'not_found' } }),
            };
          },
        };
        return builder;
      },
      upsert(row) {
        if (options.upsertErrorTable === table) {
          return { select: () => ({ single: async () => ({ data: null, error: { message: 'forced_upsert_error' } }) }) };
        }
        const rows = state[table] = state[table] ?? [];
        const existing = table === 'stream_access_sessions'
          ? rows.find((r) => r.user_id === row.user_id && (r.game_id ?? null) === (row.game_id ?? null) && r.idempotency_key === row.idempotency_key)
          : rows.find((r) => r.id === row.id);
        const target = existing ?? { ...row, id: row.id ?? crypto.randomUUID(), code: row.code ?? crypto.randomUUID() };
        Object.assign(target, row);
        if (!existing) rows.push(target);
        return { select: () => ({ single: async () => ({ data: target, error: null }) }) };
      },
    };
    return api;
  }

  const admin = {
    from: (table: string) => query(table),
    rpc: async (name: string, payload: Row) => {
      if (options.rpc?.[name]) return options.rpc[name](payload);
      if (name === 'can_user_view_stream') {
        const ent = (state.stream_entitlements ?? []).find((row) => row.user_id === payload.p_user_id && row.game_id === payload.p_game_id && row.status === 'active' && (!row.expires_at || new Date(String(row.expires_at)).getTime() > Date.now()));
        return { data: Boolean(ent), error: null };
      }
      if (name === 'consume_stream_rate_limit') return { data: true, error: null };
      return { data: null, error: null };
    },
  };
  return admin as unknown as SupabaseClient;
}

export function authedRequest(path: string, userId: string, body: Row, init: RequestInit = {}) {
  return new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': `idem-${userId}-${JSON.stringify(body).slice(0, 16)}-${crypto.randomUUID()}`,
      'x-sbbl-user-id-verified': userId,
      ...(init.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(body),
  });
}

export function baseState(overrides: Partial<TestState> = {}): TestState {
  return {
    stream_admin_config: [{ id: true, collection_id: 'https://cdn.example.com/live/main.m3u8', title: 'SBBL Live', is_live: true, active_game_id: null, updated_at: new Date().toISOString() }],
    stream_access_sessions: [],
    profiles: [],
    user_role_assignments: [],
    stream_entitlements: [],
    games: [],
    ...overrides,
  };
}
