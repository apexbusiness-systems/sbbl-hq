// Regression shields (2026-07-20): pipeline health telemetry with annotated
// good/bad ranges, and the player-identity merge tool that completes the
// parser-first POTG loop (auto-provision → later merge into real identity).
import { describe, expect, it } from 'vitest';
import { handlePipelineHealth, handlePlayerIdentityMerge, resolvePotgPlayer } from '@/worker/index';
import { createAdmin, type Row } from './broadcast-test-utils';

const ADMIN_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const LEAGUE = 'aaaaaaaa-1111-4111-8111-111111111111';

function ctx(state: Record<string, Row[]>, body?: unknown, method = 'GET') {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': 'idempotency-key-long-enough-12345',
      'x-sbbl-user-id-verified': ADMIN_ID,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return {
    req: new Request('https://local/ops/x', init),
    admin: (() => { (state as Record<string, Row[]>).user_role_assignments = [{ user_id: ADMIN_ID, role: 'super_admin' }]; return createAdmin(state); })(),
    params: {},
    env: {} as unknown as Env,
    stateRef: state,
  };
}

describe('handlePipelineHealth — annotated good/bad ranges', () => {
  it('reports ok across the board on a healthy pipeline', async () => {
    const c = ctx({ event_outbox: [], ingress_buffer: [], import_jobs: [] });
    const res = await handlePipelineHealth(c);
    const body = await res.json() as { overall: string; metrics: Record<string, { status: string; warn: number; critical: number }>; alerts: string[] };
    expect(body.overall).toBe('ok');
    expect(body.alerts).toEqual([]);
    for (const m of Object.values(body.metrics)) {
      expect(m.status).toBe('ok');
      expect(m.warn).toBeGreaterThan(0);
      expect(m.critical).toBeGreaterThan(m.warn);
    }
  });

  it('escalates to critical with alerts when the outbox backs up', async () => {
    const old = new Date(Date.now() - 90 * 60_000).toISOString();
    const pending = Array.from({ length: 120 }, (_, i) => ({ id: `e${i}`, status: 'pending', created_at: old }));
    const c = ctx({ event_outbox: pending, ingress_buffer: [], import_jobs: [] });
    const body = await (await handlePipelineHealth(c)).json() as { overall: string; metrics: Record<string, { status: string }>; alerts: string[] };
    expect(body.overall).toBe('critical');
    expect(body.metrics.outbox_pending.status).toBe('critical');
    expect(body.metrics.outbox_oldest_minutes.status).toBe('critical');
    expect(body.alerts.length).toBeGreaterThan(0);
  });

  it('counts only recent ingress failures (24h window)', async () => {
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    const c = ctx({
      event_outbox: [],
      ingress_buffer: [
        { correlation_id: 'a', status: 'failed', created_at: fresh },
        { correlation_id: 'b', status: 'failed', created_at: stale },
        { correlation_id: 'c', status: 'accepted', created_at: fresh },
      ],
      import_jobs: [],
    });
    const body = await (await handlePipelineHealth(c)).json() as { metrics: Record<string, { value: number }> };
    expect(body.metrics.ingress_failed_24h.value).toBe(1);
  });
});

describe('handlePlayerIdentityMerge — soft merge, nothing deleted', () => {
  it('re-points stats, marks source merged, audit-logs, reports conflicts', async () => {
    const state: Record<string, Row[]> = {
      players: [
        { id: 'src', user_id: 'u-src', merged_into: null },
        { id: 'tgt', user_id: 'u-tgt', merged_into: null },
      ],
      player_game_stats: [
        { game_id: 'g1', player_id: 'src' },
        { game_id: 'g2', player_id: 'src' },
        { game_id: 'g2', player_id: 'tgt' }, // conflict — target wins
      ],
      audit_logs: [],
    };
    const c = ctx(state, { sourcePlayerId: 'src', targetPlayerId: 'tgt' }, 'POST');
    const body = await (await handlePlayerIdentityMerge(c)).json() as { ok: boolean; statsReassigned: number; conflictsSkipped: number };
    expect(body.ok).toBe(true);
    expect(body.statsReassigned).toBe(1);
    expect(body.conflictsSkipped).toBe(1);
    expect(state.player_game_stats.find((s) => s.game_id === 'g1')?.player_id).toBe('tgt');
    expect(state.player_game_stats.filter((s) => s.game_id === 'g2' && s.player_id === 'tgt')).toHaveLength(1);
    expect(state.players.find((p) => p.id === 'src')?.merged_into).toBe('tgt');
    expect((state.audit_logs ?? []).some((a) => a.action === 'player_identity_merged')).toBe(true);
  });

  it('rejects self-merge and unknown players with clear messages', async () => {
    const state: Record<string, Row[]> = { players: [{ id: 'p1', merged_into: null }] };
    const self = await (await handlePlayerIdentityMerge(ctx(state, { sourcePlayerId: 'p1', targetPlayerId: 'p1' }, 'POST'))).json() as { error: string; message: string };
    expect(self.error).toBe('cannot_merge_into_self');
    expect(self.message.length).toBeGreaterThan(10);
    const missing = await (await handlePlayerIdentityMerge(ctx(state, { sourcePlayerId: 'nope', targetPlayerId: 'p1' }, 'POST'))).json() as { error: string };
    expect(missing.error).toBe('source_player_not_found');
  });

  it('refuses double merges (source or target already merged)', async () => {
    const state: Record<string, Row[]> = {
      players: [
        { id: 'a', merged_into: 'z' },
        { id: 'b', merged_into: null },
      ],
    };
    const res = await (await handlePlayerIdentityMerge(ctx(state, { sourcePlayerId: 'a', targetPlayerId: 'b' }, 'POST'))).json() as { error: string };
    expect(res.error).toBe('source_already_merged');
  });
});

describe('resolvePotgPlayer — follows identity-merge pointers', () => {
  it('attributes to the canonical player when the matched row was merged', async () => {
    const state: Record<string, Row[]> = {
      profiles: [{ id: 'pf', user_id: 'u-dup', display_name: 'Jaime Phillips' }],
      players: [
        { id: 'dup', user_id: 'u-dup', league_id: LEAGUE, merged_into: 'real' },
        { id: 'real', user_id: 'u-real', league_id: LEAGUE, merged_into: null },
      ],
    };
    const res = await resolvePotgPlayer(createAdmin(state), 'Jaime Phillips', LEAGUE, {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.playerId).toBe('real');
      expect(res.warnings).toContain('potg_followed_identity_merge');
    }
  });
});
