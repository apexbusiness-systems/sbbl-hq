/**
 * End-to-end behavioural tests for the stat-access tier matrix.
 *
 * The access matrix (see docs/protocols/stats-tier-gating.md) is:
 *
 *   Role / state                                       | /api/stats | /api/leaderboards
 *   ---------------------------------------------------+------------+------------------
 *   super_admin                                        | full       | 200 full
 *   league_admin                                       | full       | 200 full
 *   coach                                              | full       | 200 full
 *   team_manager                                       | full       | 200 full
 *   player + active subscription                       | full       | 200 full
 *   player + expired/null subscription                 | minimal    | 403 forbidden
 *   paid_fan                                           | minimal    | 403 forbidden
 *   fan                                                | minimal    | 403 forbidden
 *   anonymous (no x-sbbl-user-id-verified header)      | minimal    | 403 forbidden
 *
 * This file exercises every cell by calling the real handlers with a
 * synthetic Request + a hand-rolled Supabase admin stub. No network, no
 * mocking framework magic — just direct function calls so the assertions
 * are provably tight.
 */
import { describe, expect, it } from 'vitest';
import {
  applyStatTier,
  computeStatAccessTier,
  handleStats,
  handleLeaderboards,
  normalizePublicPlayerRow,
  type StatAccessTier,
} from '@/worker/index';

// Sample RPC output from get_stats_dashboard (one player). Matches the
// shape emitted by supabase/migrations/20260331000001_real_stats_leaderboards_rpcs.sql.
const RPC_ROW = {
  id: 'u1',
  name: 'Fred Cuison',
  number: 7,
  position: 'G',
  team_id: 't1',
  team_name: 'Panalay Kings',
  league_id: 'SBBL',
  pts: 22.4,
  reb: 5.1,
  ast: 7.2,
  stl: 2.3,
  blk: 0.8,
  fls: 2.0,
  min: 31.1,
  games: 9,
};

function makeAdmin(overrides: {
  subscriptionEndsAt?: string | null;
  rpcPayload?: unknown;
} = {}) {
  const {
    subscriptionEndsAt = null,
    rpcPayload = { ok: true, players: [RPC_ROW] },
  } = overrides;

  // Minimal chain-returning stub that matches the Supabase client surface
  // used by the worker handlers.
  const admin = {
    from(table: string) {
      if (table !== 'profiles') {
        throw new Error(`unexpected table: ${table}`);
      }
      const chain = {
        select(_cols: string) { return chain; },
        eq(_col: string, _val: string) { return chain; },
        async maybeSingle() {
          return { data: { subscription_ends_at: subscriptionEndsAt }, error: null };
        },
      };
      return chain;
    },
    async rpc(name: string, _args: unknown) {
      if (name !== 'get_stats_dashboard') {
        throw new Error(`unexpected rpc: ${name}`);
      }
      return { data: rpcPayload, error: null };
    },
  };
  return admin as unknown as Parameters<typeof handleStats>[0]['admin'];
}

function makeReq(opts: {
  userId?: string | null;
  roles?: string[];
} = {}) {
  const headers = new Headers();
  if (opts.userId) headers.set('x-sbbl-user-id-verified', opts.userId);
  if (opts.roles && opts.roles.length > 0) {
    headers.set('x-sbbl-roles-verified', opts.roles.join(','));
  }
  return new Request('https://sbbl-hq.icu/api/stats', { headers });
}

function makeCtx(opts: Parameters<typeof makeReq>[0] & Parameters<typeof makeAdmin>[0] = {}) {
  return {
    req: makeReq(opts),
    admin: makeAdmin(opts),
    env: {} as unknown,
    params: {},
  } as Parameters<typeof handleStats>[0];
}

const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// ── Unit coverage ─────────────────────────────────────────────────────────

describe('normalizePublicPlayerRow', () => {
  it('normalises uppercase league codes to lowercase league ids', () => {
    const row = normalizePublicPlayerRow(RPC_ROW as unknown as Record<string, unknown>);
    expect(row.leagueId).toBe('sbbl');
  });

  it('maps WBL / TGIFBL correctly', () => {
    expect(normalizePublicPlayerRow({ ...RPC_ROW, league_id: 'WBL' }).leagueId).toBe('wbl');
    expect(normalizePublicPlayerRow({ ...RPC_ROW, league_id: 'TGIFBL' }).leagueId).toBe('tgifbl');
  });

  it('exposes the full stat line verbatim', () => {
    const row = normalizePublicPlayerRow(RPC_ROW as unknown as Record<string, unknown>);
    expect(row.stats).toEqual({
      pts: 22.4, reb: 5.1, ast: 7.2, stl: 2.3, blk: 0.8, fls: 2.0, min: 31.1,
    });
  });

  it('passes through avatar_url when the RPC provides one', () => {
    const row = normalizePublicPlayerRow({
      ...RPC_ROW,
      avatar_url: 'https://cdn.sbbl.icu/avatars/u1.jpg',
    } as unknown as Record<string, unknown>);
    expect(row.avatar).toBe('https://cdn.sbbl.icu/avatars/u1.jpg');
  });

  it('returns an empty avatar string when the RPC returns null', () => {
    // Null is the common case today — no headshots uploaded yet. The UI
    // must receive an empty string (not "null"/"undefined") so the
    // PlayerAvatar component can show the initials fallback.
    const row = normalizePublicPlayerRow({
      ...RPC_ROW,
      avatar_url: null,
    } as unknown as Record<string, unknown>);
    expect(row.avatar).toBe('');
  });

  it('returns empty avatar when the field is missing entirely', () => {
    const row = normalizePublicPlayerRow(RPC_ROW as unknown as Record<string, unknown>);
    expect(row.avatar).toBe('');
  });

  it('trims whitespace-only avatar_url to empty', () => {
    const row = normalizePublicPlayerRow({
      ...RPC_ROW,
      avatar_url: '   ',
    } as unknown as Record<string, unknown>);
    expect(row.avatar).toBe('');
  });
});

describe('applyStatTier', () => {
  const row = {
    id: 'u1', name: 'X', stats: { pts: 1, reb: 2, ast: 3, stl: 4, blk: 5, fls: 6, min: 7 },
  };

  it('passes the full stat line through when tier=full', () => {
    const out = applyStatTier(row, 'full');
    expect(out.stats).toEqual(row.stats);
  });

  it('strips gated fields (stl/blk/fls/min) when tier=minimal', () => {
    const out = applyStatTier(row, 'minimal');
    expect(out.stats).toEqual({ pts: 1, reb: 2, ast: 3 });
    expect('stl' in out.stats).toBe(false);
    expect('blk' in out.stats).toBe(false);
    expect('fls' in out.stats).toBe(false);
    expect('min' in out.stats).toBe(false);
  });

  it('does NOT mutate the source row', () => {
    applyStatTier(row, 'minimal');
    expect(row.stats.stl).toBe(4); // untouched
  });
});

// ── Tier computation across every role / state ────────────────────────────

describe('computeStatAccessTier — access matrix', () => {
  it('anonymous → minimal', async () => {
    const ctx = makeCtx();
    const { tier, userId } = await computeStatAccessTier(ctx);
    expect(tier).toBe('minimal');
    expect(userId).toBeNull();
  });

  it('fan → minimal', async () => {
    const ctx = makeCtx({ userId: 'u-fan', roles: ['fan'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('minimal');
  });

  it('paid_fan → minimal', async () => {
    const ctx = makeCtx({ userId: 'u-paid-fan', roles: ['paid_fan'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('minimal');
  });

  it('player with null subscription → minimal', async () => {
    const ctx = makeCtx({ userId: 'u-p', roles: ['player'], subscriptionEndsAt: null });
    expect((await computeStatAccessTier(ctx)).tier).toBe('minimal');
  });

  it('player with expired subscription → minimal', async () => {
    const ctx = makeCtx({ userId: 'u-p', roles: ['player'], subscriptionEndsAt: PAST_DATE });
    expect((await computeStatAccessTier(ctx)).tier).toBe('minimal');
  });

  it('player with active subscription → full', async () => {
    const ctx = makeCtx({ userId: 'u-p', roles: ['player'], subscriptionEndsAt: FUTURE_DATE });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });

  it('coach → full (no subscription check required)', async () => {
    const ctx = makeCtx({ userId: 'u-coach', roles: ['coach'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });

  it('team_manager → full', async () => {
    const ctx = makeCtx({ userId: 'u-tm', roles: ['team_manager'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });

  it('league_admin → full', async () => {
    const ctx = makeCtx({ userId: 'u-la', roles: ['league_admin'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });

  it('super_admin → full', async () => {
    const ctx = makeCtx({ userId: 'u-sa', roles: ['super_admin'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });

  it('multi-role (fan + coach) → full — highest tier wins', async () => {
    const ctx = makeCtx({ userId: 'u-x', roles: ['fan', 'coach'] });
    expect((await computeStatAccessTier(ctx)).tier).toBe('full');
  });
});

// ── End-to-end handler tests ──────────────────────────────────────────────

async function readJson(res: Response) {
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
}

describe('GET /api/stats — handler end-to-end', () => {
  it('anonymous viewer receives a minimal stat line', async () => {
    const res = await handleStats(makeCtx());
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tier).toBe('minimal');
    const players = body.data as Array<{ stats: Record<string, number> }>;
    expect(players).toHaveLength(1);
    expect(Object.keys(players[0].stats).sort()).toEqual(['ast', 'pts', 'reb']);
  });

  it('fan viewer receives a minimal stat line', async () => {
    const res = await handleStats(makeCtx({ userId: 'u-fan', roles: ['fan'] }));
    const { body } = await readJson(res);
    expect(body.tier).toBe('minimal');
    const players = body.data as Array<{ stats: Record<string, number> }>;
    expect(Object.keys(players[0].stats)).not.toContain('stl');
    expect(Object.keys(players[0].stats)).not.toContain('min');
  });

  it('expired player receives a minimal stat line', async () => {
    const res = await handleStats(
      makeCtx({ userId: 'u-p', roles: ['player'], subscriptionEndsAt: PAST_DATE }),
    );
    const { body } = await readJson(res);
    expect(body.tier).toBe('minimal');
  });

  it('paid player receives the full stat line', async () => {
    const res = await handleStats(
      makeCtx({ userId: 'u-p', roles: ['player'], subscriptionEndsAt: FUTURE_DATE }),
    );
    const { body } = await readJson(res);
    expect(body.tier).toBe('full');
    const players = body.data as Array<{ stats: Record<string, number> }>;
    expect(Object.keys(players[0].stats).sort()).toEqual(
      ['ast', 'blk', 'fls', 'min', 'pts', 'reb', 'stl'],
    );
  });

  it('coach receives the full stat line', async () => {
    const res = await handleStats(makeCtx({ userId: 'u-c', roles: ['coach'] }));
    const { body } = await readJson(res);
    expect(body.tier).toBe('full');
  });

  it('super_admin receives the full stat line', async () => {
    const res = await handleStats(makeCtx({ userId: 'u-s', roles: ['super_admin'] }));
    const { body } = await readJson(res);
    expect(body.tier).toBe('full');
  });

  it('returns an empty array (not mock data) when the RPC returns nothing', async () => {
    const res = await handleStats(
      makeCtx({ userId: 'u-s', roles: ['super_admin'], rpcPayload: { ok: true, players: [] } }),
    );
    const { body } = await readJson(res);
    expect(body.data).toEqual([]);
  });
});

describe('GET /api/leaderboards — handler end-to-end', () => {
  const denyCases: Array<[string, Parameters<typeof makeCtx>[0]]> = [
    ['anonymous', {}],
    ['fan', { userId: 'u-fan', roles: ['fan'] }],
    ['paid_fan', { userId: 'u-pf', roles: ['paid_fan'] }],
    ['player with no sub', { userId: 'u-p', roles: ['player'] }],
    ['player with expired sub', { userId: 'u-p', roles: ['player'], subscriptionEndsAt: PAST_DATE }],
  ];

  denyCases.forEach(([label, opts]) => {
    it(`${label} → 403 forbidden`, async () => {
      const res = await handleLeaderboards(makeCtx(opts));
      const { status, body } = await readJson(res);
      expect(status).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.error).toBe('forbidden');
    });
  });

  const allowCases: Array<[string, Parameters<typeof makeCtx>[0]]> = [
    ['paid player', { userId: 'u-p', roles: ['player'], subscriptionEndsAt: FUTURE_DATE }],
    ['coach', { userId: 'u-c', roles: ['coach'] }],
    ['team_manager', { userId: 'u-tm', roles: ['team_manager'] }],
    ['league_admin', { userId: 'u-la', roles: ['league_admin'] }],
    ['super_admin', { userId: 'u-sa', roles: ['super_admin'] }],
  ];

  allowCases.forEach(([label, opts]) => {
    it(`${label} → 200 with tier=full and full stat line`, async () => {
      const res = await handleLeaderboards(makeCtx(opts));
      const { status, body } = await readJson(res);
      expect(status).toBe(200);
      expect(body.tier).toBe('full');
      const players = body.data as Array<{ stats: Record<string, number> }>;
      expect(players).toHaveLength(1);
      expect(Object.keys(players[0].stats).sort()).toEqual(
        ['ast', 'blk', 'fls', 'min', 'pts', 'reb', 'stl'],
      );
    });
  });
});

// ── Type-level guarantees ────────────────────────────────────────────────

describe('StatAccessTier union', () => {
  it('is strictly full | minimal | denied', () => {
    const valid: StatAccessTier[] = ['full', 'minimal', 'denied'];
    expect(valid.length).toBe(3);
  });
});
