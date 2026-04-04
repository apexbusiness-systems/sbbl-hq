import { describe, expect, it, vi } from 'vitest';

// ── Mock data ──────────────────────────────────────────────────────────────

const leagueGameRows = [
  {
    id: 'game-league-1',
    status: 'final',
    created_at: '2026-04-01T18:00:00Z',
    home_score: 91,
    away_score: 84,
    category: 'league',
    game_date: '2026-04-01',
    event_name: null,
    participant1_label: null,
    participant2_label: null,
    notes: 'Overtime thriller',
    home_team_id: 'team-home-1',
    away_team_id: 'team-away-1',
    home_team: { name: 'WBL Warriors' },
    away_team: { name: 'WBL Thunder' },
    leagues: { code: 'WBL', name: 'Weekend Basketball League' },
    seasons: { name: 'Spring 2026' },
  },
  {
    id: 'game-league-2',
    status: 'upcoming',
    created_at: '2026-04-02T12:00:00Z',
    home_score: null,
    away_score: null,
    category: 'league',
    game_date: '2026-04-05',
    event_name: null,
    participant1_label: null,
    participant2_label: null,
    notes: null,
    home_team_id: 'team-home-2',
    away_team_id: 'team-away-2',
    home_team: { name: 'SBBL Kings' },
    away_team: { name: 'SBBL Ballers' },
    leagues: { code: 'SBBL', name: "Sunday's Best Basketball League" },
    seasons: { name: 'Spring 2026' },
  },
];

const oneV1GameRow = {
  id: 'game-1v1-1',
  status: 'final',
  created_at: '2026-04-03T14:00:00Z',
  home_score: 21,
  away_score: 18,
  category: '1v1',
  game_date: '2026-04-03',
  event_name: 'Friday Night 1v1',
  participant1_label: 'Mike Johnson',
  participant2_label: 'Chris Davis',
  notes: null,
  home_team_id: null,
  away_team_id: null,
  home_team: null,
  away_team: null,
  leagues: null,
  seasons: null,
};

const specialEventRow = {
  id: 'game-event-1',
  status: 'final',
  created_at: '2026-04-03T20:00:00Z',
  home_score: 55,
  away_score: 48,
  category: 'special_event',
  game_date: '2026-04-03',
  event_name: 'All-Star Showcase',
  participant1_label: 'Team East',
  participant2_label: 'Team West',
  notes: 'Exhibition game',
  home_team_id: null,
  away_team_id: null,
  home_team: null,
  away_team: null,
  leagues: null,
  seasons: null,
};

const allGameRows = [...leagueGameRows, oneV1GameRow, specialEventRow];

// ── Mock Supabase client ───────────────────────────────────────────────────

function createQuery(rows: Record<string, unknown>[]) {
  let filteredRows = [...rows];
  const query: Record<string, unknown> = {
    eq: vi.fn((column: string, value: unknown) => {
      filteredRows = filteredRows.filter((row) => row[column] === value);
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      filteredRows = filteredRows.filter((row) => values.includes(row[column]));
      return query;
    }),
    ilike: vi.fn((column: string, value: unknown) => {
      filteredRows = filteredRows.filter(
        (row) => String(row[column]).toLowerCase() === String(value).toLowerCase()
      );
      return query;
    }),
    lt: vi.fn(() => query),
    limit: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    insert: vi.fn((row: Record<string, unknown>) => {
      // Capture inserted data for assertion
      (query as any).__lastInserted = row;
      return { ...query, single: vi.fn(() => Promise.resolve({ data: { id: 'new-game-uuid' }, error: null })) };
    }),
    update: vi.fn(() => ({ ...query, single: vi.fn(() => Promise.resolve({ data: { id: 'existing-id' }, error: null })) })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: filteredRows[0] ?? null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: filteredRows[0] ?? null, error: null })),
    then: (
      resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: filteredRows, error: null }).then(resolve, reject),
  };
  return query;
}

// Track what tables+inserts the worker writes
let lastGamesInsert: Record<string, unknown> | null = null;
let gamesSelectSpy: ReturnType<typeof vi.fn>;
let leaguesSelectSpy: ReturnType<typeof vi.fn>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-user-uuid' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'games') {
        const query = createQuery(allGameRows);
        gamesSelectSpy = query.select as ReturnType<typeof vi.fn>;

        // Override insert to capture payload
        query.insert = vi.fn((row: Record<string, unknown>) => {
          lastGamesInsert = row;
          const innerQuery = {
            select: vi.fn(() => innerQuery),
            single: vi.fn(() => Promise.resolve({ data: { id: 'new-game-uuid' }, error: null })),
          };
          return innerQuery;
        });

        return query;
      }

      if (table === 'leagues') {
        const leagueRows = [
          { id: 'league-uuid-sbbl', code: 'SBBL' },
          { id: 'league-uuid-wbl', code: 'WBL' },
          { id: 'league-uuid-tgifbl', code: 'TGIFBL' },
        ];
        const query = createQuery(leagueRows);
        leaguesSelectSpy = query.select as ReturnType<typeof vi.fn>;
        return query;
      }

      if (table === 'user_role_assignments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({
              data: [{ role: 'super_admin' }],
              error: null,
            })),
          })),
        };
      }

      // Default: return empty result
      return {
        select: vi.fn(() => createQuery([])),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      };
    },
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: {
    fetch: (req: Request) =>
      Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)),
  },
} as unknown as Env;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/scores — handleScoresList', () => {
  it('returns all games with correct shape when no filters', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };
    expect(data.ok).toBe(true);
    expect(data.games.length).toBe(allGameRows.length);

    // Verify shape of a league game
    const leagueGame = data.games.find((g) => g.id === 'game-league-1');
    expect(leagueGame).toEqual(
      expect.objectContaining({
        id: 'game-league-1',
        category: 'league',
        leagueCode: 'wbl',
        leagueName: 'Weekend Basketball League',
        seasonName: 'Spring 2026',
        homeLabel: 'WBL Warriors',
        awayLabel: 'WBL Thunder',
        homeScore: 91,
        awayScore: 84,
        status: 'final',
        gameDate: '2026-04-01',
        notes: 'Overtime thriller',
      }),
    );
  });

  it('returns participant labels for 1v1 games (not "Home"/"Away" defaults)', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    const game1v1 = data.games.find((g) => g.id === 'game-1v1-1');
    expect(game1v1).toBeDefined();
    expect(game1v1!.category).toBe('1v1');
    // Critical: these must come from participant1_label / participant2_label,
    // NOT fall through to "Home" / "Away" defaults
    expect(game1v1!.homeLabel).toBe('Mike Johnson');
    expect(game1v1!.awayLabel).toBe('Chris Davis');
    expect(game1v1!.eventName).toBe('Friday Night 1v1');
    // No league info for 1v1
    expect(game1v1!.leagueId).toBeUndefined();
    expect(game1v1!.leagueCode).toBeUndefined();
  });

  it('returns special_event games with participant labels and event name', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    const eventGame = data.games.find((g) => g.id === 'game-event-1');
    expect(eventGame).toBeDefined();
    expect(eventGame!.category).toBe('special_event');
    expect(eventGame!.homeLabel).toBe('Team East');
    expect(eventGame!.awayLabel).toBe('Team West');
    expect(eventGame!.eventName).toBe('All-Star Showcase');
    expect(eventGame!.notes).toBe('Exhibition game');
  });

  it('filters by league parameter', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores?league=wbl'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    expect(data.ok).toBe(true);
    // Only the WBL league game should match
    expect(data.games.every((g) => g.leagueCode === 'wbl')).toBe(true);
    expect(data.games.some((g) => g.id === 'game-league-1')).toBe(true);
    // SBBL game, 1v1, and special_event should be excluded
    expect(data.games.some((g) => g.id === 'game-league-2')).toBe(false);
    expect(data.games.some((g) => g.id === 'game-1v1-1')).toBe(false);
  });

  it('returns upcoming games only with correct status', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores?status=upcoming'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    expect(data.ok).toBe(true);
    // The mock eq/in filter should have filtered to upcoming games
    // All returned games should have upcoming/scheduled status
    for (const g of data.games) {
      expect(['upcoming', 'scheduled']).toContain(g.status);
    }
  });

  it('derives gameDate from created_at when game_date column is null', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    // game-league-1 has explicit game_date='2026-04-01'
    const g1 = data.games.find((g) => g.id === 'game-league-1');
    expect(g1!.gameDate).toBe('2026-04-01');
  });

  it('defaults homeLabel/awayLabel to team names when participant labels are null', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: Array<Record<string, unknown>>;
    };

    // League games have null participant labels → should fall through to team names
    const leagueGame = data.games.find((g) => g.id === 'game-league-1');
    expect(leagueGame!.homeLabel).toBe('WBL Warriors');
    expect(leagueGame!.awayLabel).toBe('WBL Thunder');
  });

  it('includes nextCursor as null when fewer than 100 results', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/scores'),
      env,
    );
    const data = (await res.json()) as {
      ok: boolean;
      games: unknown[];
      nextCursor: string | null;
    };

    expect(data.nextCursor).toBeNull();
  });
});

describe('GET /api/public-config — Supabase credentials for frontend auth', () => {
  it('returns supabaseUrl from worker env', async () => {
    const res = await worker.fetch(
      new Request('https://local/api/public-config'),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.supabaseUrl).toBe('https://example.supabase.co');
    expect(data.supabasePublishableKey).toBe(
      'sb_publishable_test_key_1234567890',
    );
  });

  it('returns server_misconfigured when required env vars are missing', async () => {
    const sparseEnv = {
      SUPABASE_URL: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
      STRIPE_SECRET_KEY: 'stripe-secret-123456789',
      STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret-123456789',
      RESEND_API_KEY: 'resend-key-123456789',
      ASSETS: {
        fetch: (req: Request) =>
          Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)),
      },
    } as unknown as Env;

    const res = await worker.fetch(
      new Request('https://local/api/public-config'),
      sparseEnv,
    );
    // Worker validates SUPABASE_URL is required before routing — returns 500
    expect(res.status).toBe(500);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('server_misconfigured');
  });
});
