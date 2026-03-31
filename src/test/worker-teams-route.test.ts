import { describe, expect, it, vi } from 'vitest';

const baseTeamRows = [
  {
    id: 'team-wbl',
    league_id: 'league-wbl',
    name: 'WBL Warriors',
    leagues: { code: 'wbl', name: 'Weekend Basketball League' },
    seasons: { name: 'Spring 2026' },
    divisions: { name: 'Open' },
    players: [
      { id: 'p1', user_id: 'u1', jersey_number: 7, position: 'G', profiles: { first_name: 'Wes', last_name: 'Ball', avatar_url: null } },
      { id: 'p2', user_id: 'u2', jersey_number: 11, position: 'F', profiles: { first_name: 'Lee', last_name: 'Guard', avatar_url: null } },
    ],
    team_memberships: [{ id: 'm1', role: 'team_manager', profiles: { first_name: 'Coach', last_name: 'One', avatar_url: null } }],
  },
  {
    id: 'team-sbbl',
    league_id: 'league-sbbl',
    name: 'SBBL Lions',
    leagues: { code: 'sbbl', name: "Sunday's Best Basketball League" },
    seasons: { name: 'Spring 2026' },
    divisions: { name: 'Premier' },
    players: [
      { id: 'p3', user_id: 'u3', jersey_number: 3, position: 'C', profiles: { first_name: 'Sam', last_name: 'Big', avatar_url: null } },
    ],
    team_memberships: [{ id: 'm3', role: 'coach', profiles: { first_name: 'Coach', last_name: 'Two', avatar_url: null } }],
  },
];

const baseGameRows = [
  {
    id: 'game-1',
    home_team_id: 'team-wbl',
    away_team_id: 'team-sbbl',
    home_score: 90,
    away_score: 80,
    league_id: 'league-wbl',
    seasons: { leagues: { code: 'wbl' } },
  },
];

const teamSelect = vi.fn();
const gameSelect = vi.fn();

function createTeamsQuery(rows = baseTeamRows) {
  let filteredRows = rows;
  const query = {
    eq: vi.fn((column: string, value: string) => {
      if (column === 'league_id') {
        filteredRows = rows.filter((row) => row.league_id === value);
      }
      return query;
    }),
    limit: vi.fn(() => query),
    then: (resolve: (value: { data: typeof filteredRows; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: filteredRows, error: null }).then(resolve, reject),
  };

  return query;
}

function createGamesQuery(rows = baseGameRows) {
  let filteredRows = rows;
  const query = {
    eq: vi.fn((column: string, value: string) => {
      if (column === 'league_id') {
        filteredRows = rows.filter((row) => row.league_id === value);
      }
      return query;
    }),
    then: (resolve: (value: { data: typeof filteredRows; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: filteredRows, error: null }).then(resolve, reject),
  };

  return query;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'teams') {
        const query = createTeamsQuery();
        return {
          select: teamSelect.mockImplementation((selection: string) => {
            expect(selection).toContain('leagues(code,name)');
            expect(selection).toContain('players(');
            expect(selection).toContain('team_memberships(');
            return {
              eq: query.eq,
              limit: query.limit,
            };
          }),
        };
      }

      if (table === 'games') {
        const query = createGamesQuery();
        return {
          select: gameSelect.mockImplementation((selection: string) => {
            expect(selection).toContain('seasons(leagues(code))');
            return {
              eq: query.eq,
            };
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

import worker from '@/worker/index';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456789',
  STRIPE_SECRET_KEY: 'stripe-secret-123456789',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-123456789',
  RESEND_API_KEY: 'resend-key-123456789',
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('worker public teams route', () => {
  it('returns league codes required by the Teams page filters', async () => {
    const res = await worker.fetch(new Request('https://local/api/teams'), env);
    expect(res.status).toBe(200);

    const data = await res.json() as {
      ok: boolean;
      teams: Array<{ name: string; league_code: string; roster_count: number }>;
    };

    expect(data.ok).toBe(true);
    expect(data.teams).toEqual([
      expect.objectContaining({
        name: 'WBL Warriors',
        league_code: 'WBL',
        roster_count: 2,
      }),
      expect.objectContaining({
        name: 'SBBL Lions',
        league_code: 'SBBL',
        roster_count: 1,
      }),
    ]);
  });

  it('keeps league filtering intact on the same endpoint', async () => {
    const res = await worker.fetch(new Request('https://local/api/teams?leagueId=wbl'), env);
    expect(res.status).toBe(200);

    const data = await res.json() as {
      teams: Array<{ id: string; league_code: string }>;
    };

    expect(data.teams).toEqual([
      expect.objectContaining({
        id: 'team-wbl',
        league_code: 'WBL',
      }),
    ]);
  });
});
