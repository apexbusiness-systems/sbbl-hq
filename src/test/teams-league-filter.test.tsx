/**
 * REGRESSION SHIELD — Teams page case-insensitive league_code filter
 *
 * Bug fixed: strict === comparison between t.league_code and getLeagueConfig().code
 * silently returned 0 teams if DB returned mixed-case codes (e.g. 'wbl' instead of 'WBL').
 * No error was thrown — the empty state showed "No teams found" which looked like missing data.
 *
 * Fix: Both sides normalised to .toUpperCase() before comparison.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from '@/test/utils/router';

import { describe, expect, it, vi } from 'vitest';
import TeamsPage from '@/pages/Teams';

// ── Mock teams with mixed-case league_code (the exact failure scenario) ──────
const mockTeams = [
  {
    id: 'team-wbl-1',
    name: 'WBL Warriors',
    league_code: 'WBL',          // uppercase — what the worker outputs today
    league_name: 'Weekend Basketball League',
    season_name: 'Spring 2026',
    division_name: 'Open',
    roster_count: 10,
    players: [],
    coaches: [],
    stats: { wins: 3, losses: 1, gamesPlayed: 4, ptsFor: 320, ptsAgainst: 290, winPct: '.750', diff: 30 },
  },
  {
    id: 'team-wbl-legacy',
    name: 'WBL Legacy Squad',
    league_code: 'wbl',          // lowercase — legacy DB row not yet normalised
    league_name: 'Weekend Basketball League',
    season_name: 'Spring 2026',
    division_name: null,
    roster_count: 8,
    players: [],
    coaches: [],
    stats: { wins: 1, losses: 2, gamesPlayed: 3, ptsFor: 210, ptsAgainst: 240, winPct: '.333', diff: -30 },
  },
  {
    id: 'team-sbbl-1',
    name: 'SBBL Kings',
    league_code: 'SBBL',
    league_name: "Sunday's Best Basketball League",
    season_name: 'Spring 2026',
    division_name: null,
    roster_count: 12,
    players: [],
    coaches: [],
    stats: { wins: 5, losses: 0, gamesPlayed: 5, ptsFor: 480, ptsAgainst: 390, winPct: '1.000', diff: 90 },
  },
];

vi.mock('@/lib/api/teams', () => ({
  fetchTeams: vi.fn(async () => ({
    ok: true,
    teams: mockTeams,
  })),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    activeLeague: 'all',
    setActiveLeague: vi.fn(),
    isAdmin: false,
    bagItems: [],
    setBagOpen: vi.fn(),
  }),
}));

function renderTeams(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={ROUTER_FUTURE} initialEntries={[`/teams${search}`]}>
        <TeamsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Teams page — case-insensitive league_code filter regression', () => {
  it('shows all teams when filter is "all"', async () => {
    renderTeams();
    expect(await screen.findByText('WBL Warriors')).toBeInTheDocument();
    expect(await screen.findByText('WBL Legacy Squad')).toBeInTheDocument();
    expect(await screen.findByText('SBBL Kings')).toBeInTheDocument();
  });

  it('shows BOTH wbl teams regardless of mixed case in league_code (case-insensitive fix)', async () => {
    renderTeams('?league=wbl');
    // WBL Warriors has league_code='WBL' (uppercase) — should match
    expect(await screen.findByText('WBL Warriors')).toBeInTheDocument();
    // WBL Legacy Squad has league_code='wbl' (lowercase) — MUST also match after the fix
    // Before the fix, strict '===' would silently exclude lowercase-coded teams
    expect(await screen.findByText('WBL Legacy Squad')).toBeInTheDocument();
    // SBBL Kings should NOT be shown
    expect(screen.queryByText('SBBL Kings')).not.toBeInTheDocument();
  });

  it('shows only SBBL teams when filtered to sbbl', async () => {
    renderTeams('?league=sbbl');
    expect(await screen.findByText('SBBL Kings')).toBeInTheDocument();
    expect(screen.queryByText('WBL Warriors')).not.toBeInTheDocument();
    expect(screen.queryByText('WBL Legacy Squad')).not.toBeInTheDocument();
  });
});
