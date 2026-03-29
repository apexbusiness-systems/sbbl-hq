import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import TeamsPage from '@/pages/Teams';

vi.mock('@/lib/api/teams', () => ({
  fetchTeams: vi.fn(async () => ({
    ok: true,
    teams: [{
      id: 't1',
      name: 'SBBL Lions',
      league_name: 'SBBL',
      season_name: '2026',
      division_name: 'A',
      roster_count: 12,
    }],
  })),
}));

describe('teams page', () => {
  it('renders fetched teams', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <TeamsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('SBBL Lions')).toBeInTheDocument();
    expect(screen.getByText('Roster count:')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
