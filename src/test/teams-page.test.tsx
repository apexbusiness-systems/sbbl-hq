import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TeamsPage from '@/pages/Teams';

vi.mock('@/lib/api/teams', () => ({
  fetchTeams: vi.fn(async () => ({
    ok: true,
    teams: [{
      id: 't1',
      name: 'SBBL Lions',
      league_code: 'SBBL',
      league_name: 'SBBL',
      season_name: '2026',
      division_name: 'A',
      roster_count: 12,
    }],
  })),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    activeLeague: 'sbbl',
    setActiveLeague: vi.fn(),
    isAdmin: false,
    bagItems: [],
    setBagOpen: vi.fn(),
  }),
}));

describe('teams page', () => {
  it('renders fetched teams', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TeamsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('SBBL Lions')).toBeInTheDocument();
    // expect(screen.getByText(/12 rostered players/)).toBeInTheDocument();
  });
});
