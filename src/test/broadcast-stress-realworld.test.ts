import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { handleBroadcastSessionStart } from '@/worker/index';
import { testEnv, type Row } from './broadcast-test-utils';

type BroadcastSessionCtx = Parameters<typeof handleBroadcastSessionStart>[0];
type QueryResponse<T> = { data: T; error: { message: string } | null };
type StressQueryApi = {
  select: () => StressQueryApi;
  eq: (col: string, value: unknown) => StressQueryApi;
  is: (col: string, value: unknown) => StressQueryApi;
  neq: (col: string, value: unknown) => { error: null };
  maybeSingle: () => Promise<QueryResponse<Row | null>>;
  insert: () => { error: null };
  update: () => StressQueryApi;
  upsert: (row: Row) => { select: () => { single: () => Promise<QueryResponse<Row>> } };
  then: (resolve: (value: QueryResponse<Row[]>) => unknown) => Promise<unknown>;
};
type PlaybackBody = { playback?: { url?: unknown } };

const describeStress = process.env.STRESS === '1' ? describe : describe.skip;

function createStressAdmin(state: Record<string, Row[]>): SupabaseClient {
  let sessionSeq = 0;
  const admin = {
    from(table: string): StressQueryApi {
      const filters: Array<(row: Row) => boolean> = [];
      const api: StressQueryApi = {
        select: () => api,
        eq(col, value) { filters.push((row) => row[col] === value); return api; },
        is(col, value) { filters.push((row) => (value === null ? row[col] == null : row[col] === value)); return api; },
        neq(col, value) { filters.push((row) => row[col] !== value); return { error: null }; },
        maybeSingle: async () => ({ data: (state[table] ?? []).find((row) => filters.every((fn) => fn(row))) ?? null, error: null }),
        insert: () => ({ error: null }),
        update: () => api,
        upsert(row) {
          const rows = state[table] = state[table] ?? [];
          const existing = rows.find((item) => item.user_id === row.user_id && (item.game_id ?? null) === (row.game_id ?? null) && item.idempotency_key === row.idempotency_key);
          const target = existing ?? { id: `stress-session-${sessionSeq += 1}` };
          Object.assign(target, row);
          if (!existing) rows.push(target);
          return { select: () => ({ single: async () => ({ data: target, error: null }) }) };
        },
        then: async (resolve) => resolve({ data: (state[table] ?? []).filter((row) => filters.every((fn) => fn(row))), error: null }),
      };
      return api;
    },
  };
  return admin as unknown as SupabaseClient;
}

describeStress('broadcast stress real-world simulation', () => {
  it('500 registered fans receive open-broadcast playback sessions within in-process SLO', async () => {
    const state: Record<string, Row[]> = {
      stream_admin_config: [{ id: true, collection_id: 'https://cdn.example.com/live/main.m3u8', title: 'SBBL Live', is_live: true, active_game_id: null }],
      stream_access_sessions: [],
      profiles: [],
      user_role_assignments: [],
    };
    for (let i = 0; i < 500; i += 1) {
      state.user_role_assignments.push({ user_id: `fan-${i}`, role: 'fan' });
      state.profiles.push({ user_id: `fan-${i}`, onboarding_completed_at: new Date().toISOString() });
    }
    const admin = createStressAdmin(state);
    const responses = await Promise.all(Array.from({ length: 500 }, async (_, i) => {
      const req = new Request('https://worker.test/api/broadcast/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': `stress-idem-${i}`,
          'x-sbbl-user-id-verified': `fan-${i}`,
        },
        body: JSON.stringify({ sessionKey: `device-session-${i}` }),
      });
      return handleBroadcastSessionStart({ req, env: testEnv, params: {}, admin } as BroadcastSessionCtx);
    }));

    const statuses = responses.map((res) => res.status);
    const bodies = await Promise.all(responses.map((res) => res.json() as Promise<PlaybackBody>));
    const probeLatencies: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const probeId = `probe-${i}`;
      state.user_role_assignments.push({ user_id: probeId, role: 'fan' });
      state.profiles.push({ user_id: probeId, onboarding_completed_at: new Date().toISOString() });
      const req = new Request('https://worker.test/api/broadcast/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': `probe-idem-${i}`, 'x-sbbl-user-id-verified': probeId },
        body: JSON.stringify({ sessionKey: `probe-session-${i}` }),
      });
      const started = performance.now();
      const probe = await handleBroadcastSessionStart({ req, env: testEnv, params: {}, admin } as BroadcastSessionCtx);
      expect(probe.status).toBe(200);
      probeLatencies.push(performance.now() - started);
    }
    const sorted = [...probeLatencies].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

    expect(statuses.filter((status) => status === 200)).toHaveLength(500);
    expect(statuses.filter((status) => status === 403)).toHaveLength(0);
    expect(bodies.every((body) => typeof body.playback?.url === 'string' && body.playback.url.length > 0)).toBe(true);
    expect(state.stream_access_sessions.filter((row) => String(row.user_id).startsWith('fan-'))).toHaveLength(500);
    const fanSessions = state.stream_access_sessions.filter((row) => String(row.user_id).startsWith('fan-'));
    const uniqueLogicalSessions = new Set(fanSessions.map((row) => `${row.user_id}:${row.game_id ?? 'broadcast'}:${row.idempotency_key}`));
    expect(uniqueLogicalSessions.size).toBe(500);
    expect(percentile(0.99)).toBeLessThan(200);
  });
});
