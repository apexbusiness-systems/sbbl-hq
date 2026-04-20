import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';
import { fetchPublicHome } from '@/lib/api/public';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, session: { access_token: 'token' }, roles: ['super_admin'] }),
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ hasPremiumPlayerAccess: true }),
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
    data: { liveGames: [], upcomingGames: [] },
  })),
}));

vi.mock('@/lib/api/stream', () => ({
  fetchAdminStreamConfig: vi.fn(async () => ({
    ok: true,
    config: { isLive: true, title: 'Camera Feed', collectionId: 'https://example.com/live.m3u8' },
  })),
  fetchPublicStreamStatus: vi.fn(async () => ({ ok: true, isLive: true, title: 'Camera Feed', viewerCount: 0 })),
  fetchStreamComments: vi.fn(async () => ({ ok: true, comments: [] })),
  postStreamComment: vi.fn(async () => ({ ok: true })),
  setStreamLive: vi.fn(async () => ({ ok: true, isLive: true })),
  updateStreamConfig: vi.fn(async () => ({ ok: true })),
}));

describe('Live page camera-only mode', () => {
  it('keeps super_admin in broadcast mode even when only upcoming games exist', async () => {
    vi.mocked(fetchPublicHome).mockResolvedValueOnce({
      ok: true,
      data: {
        liveGames: [],
        upcomingGames: [
          {
            id: 'upcoming-1',
            home_team_id: 'home-team',
            away_team_id: 'away-team',
            home_team: { name: 'Home' },
            away_team: { name: 'Away' },
            league_code: 'SBBL',
            status: 'upcoming',
            scheduled_at: new Date().toISOString(),
          },
        ],
      },
    });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('broadcast');
    });
  });

  it('mounts playback with broadcast alias when live and no game rows exist', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('broadcast');
    });
  });
});
