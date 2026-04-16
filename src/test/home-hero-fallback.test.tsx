import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/pages/Home';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ roles: ['fan'], isAdmin: false, configAvailable: true, loading: false }),
}));

vi.mock('@/lib/api/public', () => ({
  fetchPublicHome: vi.fn().mockResolvedValue({ ok: true, data: {
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
  } }),
  fetchPublicPotg: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AppProvider>
          <HomePage />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('home hero fallback', () => {
  it('renders league snapshot heading when data is loaded', async () => {
    renderHome();
    expect(await screen.findByText('League Snapshot')).toBeInTheDocument();
  });

  it('shows empty state when no teams or games exist', async () => {
    renderHome();
    expect(await screen.findByText('Season Coming Soon')).toBeInTheDocument();
  });
});
