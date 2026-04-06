/**
 * REGRESSION SHIELD — Scores page client-side filtering
 *
 * Bug fixed: queryKey included all 3 filter states (category, leagueFilter, statusFilter),
 * causing a new network request per filter combination. Any failed request left that
 * filter combo in an error/empty state. statusFilter (local state) in the queryKey
 * created orphaned cache entries that were never revalidated on navigation.
 *
 * Fix: Static queryKey ['scores'] — fetchScores() with no params fetches ALL games once.
 * Client-side useMemo handles all filtering. Switching filters never triggers a new request.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ScoresPage from '@/pages/Scores';

// ── Mock data ──────────────────────────────────────────────────────────────
const mockGames = [
  {
    id: 'game-wbl-1',
    category: 'league',
    leagueId: 'wbl',
    leagueCode: 'wbl',
    leagueName: 'Weekend Basketball League',
    seasonName: 'Spring 2026',
    homeLabel: 'WBL Warriors',
    awayLabel: 'WBL Thunder',
    homeScore: 91,
    awayScore: 84,
    status: 'final',
    gameDate: '2026-04-01',
  },
  {
    id: 'game-sbbl-1',
    category: 'league',
    leagueId: 'sbbl',
    leagueCode: 'sbbl',
    leagueName: "Sunday's Best Basketball League",
    seasonName: 'Spring 2026',
    homeLabel: 'SBBL Kings',
    awayLabel: 'SBBL Ballers',
    homeScore: undefined,
    awayScore: undefined,
    status: 'upcoming',
    gameDate: '2026-04-05',
  },
  {
    id: 'game-1v1-1',
    category: '1v1',
    leagueId: undefined,
    leagueCode: undefined,
    homeLabel: 'Mike Johnson',
    awayLabel: 'Chris Davis',
    homeScore: 21,
    awayScore: 18,
    status: 'final',
    gameDate: '2026-04-03',
    eventName: 'Friday Night 1v1',
  },
];

const fetchScoresSpy = vi.fn(async () => ({
  ok: true,
  games: mockGames,
  nextCursor: null,
}));

vi.mock('@/lib/api/scores', () => ({
  fetchScores: (...args: unknown[]) => fetchScoresSpy(...args),
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

function renderScores(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/scores${search}`]}>
        <ScoresPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Scores page — client-side filtering regression', () => {
  beforeEach(() => {
    fetchScoresSpy.mockClear();
  });

  it('renders all games on initial load', async () => {
    renderScores();
    expect(await screen.findByText('WBL Warriors')).toBeInTheDocument();
    expect(await screen.findByText('SBBL Kings')).toBeInTheDocument();
    expect(await screen.findByText('Mike Johnson')).toBeInTheDocument();
  });

  it('fetchScores is called with NO params — static queryKey fetches all data once', async () => {
    renderScores();
    // Wait for data to load
    await screen.findByText('WBL Warriors');

    // CRITICAL: fetchScores must be called with no arguments (or undefined)
    // so the worker returns ALL games, not a filtered subset.
    // If params were passed, different filter combos would each trigger new requests.
    expect(fetchScoresSpy).toHaveBeenCalledTimes(1);
    const [calledWithParams] = fetchScoresSpy.mock.calls[0];
    // fetchScores() called with no args or with undefined — never with filter params
    expect(calledWithParams).toBeUndefined();
  });
});
