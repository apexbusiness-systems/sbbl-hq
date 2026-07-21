import { describe, expect, it, vi } from 'vitest';

const teamsRows = [
  {
    id: 'team-1',
    league_id: 'league-wbl',
    name: 'WBL Warriors',
    status: 'published',
    leagues: { code: 'wbl', name: 'Weekend Basketball League' },
    seasons: { name: 'Spring 2026' },
    divisions: { name: 'Open' },
    players: [
      { id: 'player-1', user_id: 'user-player-1', jersey_number: 23, position: 'G' },
    ],
    team_memberships: [
      { id: 'member-1', user_id: 'user-coach-1', role: 'team_manager' },
    ],
  },
];

// mvw_standings: pre-computed standings (P2-D materialized view).
// league_id present because handleTeamsList now filters standings DB-side by
// the resolved league UUID (league-resolution consolidation, PR #571).
const standingsRows = [
  { team_id: 'team-1', league_id: 'league-wbl', wins: 1, losses: 0, pts_for: 91, pts_against: 84 },
];

const profilesRows = [
  { user_id: 'user-player-1', full_name: 'Jordan Banks', display_name: null, avatar_url: 'https://example.com/player.png' },
  { user_id: 'user-coach-1', full_name: null, display_name: 'Coach Carter', avatar_url: 'https://example.com/coach.png' },
];

function createQuery(rows: Record<string, unknown>[]) {
  let filteredRows = rows;
  const query = {
    eq: vi.fn((column: string, value: unknown) => {
      filteredRows = filteredRows.filter((row) => row[column] === value);
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      filteredRows = filteredRows.filter((row) => values.includes(row[column]));
      return query;
    }),
    limit: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: filteredRows, error: null }).then(resolve, reject),
  };

  return query;
}

const teamSelect = vi.fn();
const standingsSelect = vi.fn();
const profilesSelect = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'teams') {
        const query = createQuery(teamsRows);
        return {
          select: teamSelect.mockImplementation((selection: string) => {
            expect(selection).toContain('players(id,jersey_number,position,user_id)');
            expect(selection).toContain('team_memberships(id,user_id,role)');
            expect(selection).not.toContain('profiles(');
            return query;
          }),
        };
      }

      // P2-D: mvw_standings replaces the games query for standings computation
      if (table === 'mvw_standings') {
        const query = createQuery(standingsRows);
        return {
          select: standingsSelect.mockImplementation(() => query),
        };
      }

      if (table === 'profiles') {
        const query = createQuery(profilesRows);
        return {
          select: profilesSelect.mockImplementation((selection: string) => {
            expect(selection).toBe('user_id,full_name,display_name,avatar_url');
            return query;
          }),
        };
      }

      // leagues: backs resolveLeagueId (shared.ts) — the route resolves the
      // ?leagueId=wbl slug to the leagues.id value before filtering (PR #571).
      if (table === 'leagues') {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn((_col: string, pattern: string) => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve(
                  String(pattern).toLowerCase() === 'wbl'
                    ? { data: { id: 'league-wbl' }, error: null }
                    : { data: null, error: null },
                ),
              ),
            })),
          })),
        };
      }

      // Unknown tables return empty result — allows graceful fallback paths
      return { select: vi.fn(() => createQuery([])) };
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
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

describe('worker teams route', () => {
  it('hydrates player and coach names from the real profiles schema', async () => {
    const res = await worker.fetch(new Request('https://local/api/teams?leagueId=wbl'), env);
    expect(res.status).toBe(200);

    const data = await res.json() as {
      ok: boolean;
      teams: Array<{
        id: string;
        league_code: string;
        stats: { wins: number; losses: number; gamesPlayed: number };
        players: Array<{ first_name: string | null; last_name: string | null; avatar_url: string | null }>;
        coaches: Array<{ first_name: string | null; last_name: string | null; avatar_url: string | null; role: string }>;
      }>;
    };

    expect(data.ok).toBe(true);
    expect(data.teams).toEqual([
      expect.objectContaining({
        id: 'team-1',
        league_code: 'WBL',
        stats: expect.objectContaining({
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
        }),
        players: [
          expect.objectContaining({
            first_name: 'Jordan',
            last_name: 'Banks',
            avatar_url: 'https://example.com/player.png',
          }),
        ],
        coaches: [
          expect.objectContaining({
            first_name: 'Coach',
            last_name: 'Carter',
            avatar_url: 'https://example.com/coach.png',
            role: 'team_manager',
          }),
        ],
      }),
    ]);
  });
});
