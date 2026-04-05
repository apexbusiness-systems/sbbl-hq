import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'token' }, roles: ['fan'] }),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ hasPremiumPlayerAccess: false }),
}));

vi.mock('@/contexts/BagContext', () => ({
  useBag: () => ({
    addToBag: vi.fn(),
    bagItems: [],
    removeFromBag: vi.fn(),
    bagOpen: false,
    setBagOpen: vi.fn(),
  }),
}));

vi.mock('@/components/LiveStreamPlayer', () => ({
  LiveStreamPlayer: ({ game }: { game: { id: string } }) => <div data-testid="live-player">game:{game.id}</div>,
}));

vi.mock('@/lib/api/public', () => ({
  fetchPublicHome: vi.fn(async () => ({
    ok: true,
    data: {
      liveGames: [{
        id: 'game-live-1',
        status: 'live',
        league_code: 'SBBL',
        home_team_id: 'h1',
        away_team_id: 'a1',
        home_team: { name: 'Home Team' },
        away_team: { name: 'Away Team' },
        home_score: 45,
        away_score: 42,
      }],
      upcomingGames: [],
    },
  })),
}));

vi.mock('@/lib/api/stream', () => ({
  fetchPublicStreamStatus: vi.fn(async () => ({
    ok: true,
    isLive: true,
    title: 'Live Now',
    gameId: 'game-live-1',
    viewerCount: 10,
  })),
}));

describe('Live page secure path', () => {
  it('binds live stream player to backend-resolved game id', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('game-live-1');
    });
  });
});
