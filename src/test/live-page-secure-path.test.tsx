import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'token' }, roles: ['fan'] }),
}));

vi.mock('@/hooks/useLiveAccess', () => ({
  useLiveAccess: () => ({ access: { granted: true }, config: { enabled: false } }),
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


vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
}));

vi.mock('@/lib/api/client', () => ({
  getAuthToken: vi.fn(async () => null),
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes('/reactions')) {
      return { ok: true, fire: 0, heart: 0, clap: 0 };
    }
    if (path.includes('/products')) {
      return { ok: true, data: [] };
    }
    return { ok: true };
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

beforeEach(() => {
  vi.useRealTimers();
});

describe('Live page secure path', () => {
  it('binds live stream player to backend-resolved game id', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } })}>
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
