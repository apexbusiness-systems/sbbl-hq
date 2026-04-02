import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/pages/Home';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ roles: ['fan'], isAdmin: false, configAvailable: true, loading: false }),
}));

vi.mock('@/lib/api/public', () => ({
  fetchPublicHome: vi.fn().mockResolvedValue({
    ok: true,
    league: { id: 'l1', name: 'SBBL', code: 'SBBL' },
    season: { id: 's1', name: 'Season 1', status: 'active' },
    teams: [],
    totalTeams: 0,
    totalRostered: 0,
    liveGames: [],
    upcomingGames: [],
    recentGames: [],
    totalGames: 0,
    leagues: [],
  }),
}));


const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('home hero fallback', () => {
  it('renders league snapshot heading when data is loaded', async () => {
    render(
      <QueryClientProvider client={queryClient}><BrowserRouter>
        <AppProvider>
          <HomePage />
        </AppProvider>
      </BrowserRouter></QueryClientProvider>,
    );

    expect(await screen.findByText('League Snapshot')).toBeInTheDocument();
  });

  it('shows empty state when no teams or games exist', async () => {
    render(
      <QueryClientProvider client={queryClient}><BrowserRouter>
        <AppProvider>
          <HomePage />
        </AppProvider>
      </BrowserRouter></QueryClientProvider>,
    );

    expect(await screen.findByText('Season Coming Soon')).toBeInTheDocument();
  });
});
