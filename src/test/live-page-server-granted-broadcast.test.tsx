import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from '@/test/utils/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';

let publicHomeLiveGames: Array<Record<string, unknown>> = [];
let activeBroadcastGameId: string | null = null;
let viewerPreflightEnabled = false;

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'fan-1' },
    session: { access_token: 'token' },
    roles: ['fan'],
    needsOnboarding: false,
    loading: false,
  }),
}));

vi.mock('@/hooks/useLiveAccess', () => ({
  useLiveAccess: () => ({
    access: 'paywall',
    config: { isLive: true, videoUrl: null, title: 'Open Broadcast' },
  }),
}));

vi.mock('@/lib/feature-flags', () => ({
  isViewerPreflightEnabled: () => viewerPreflightEnabled,
  isFanTokenSystemEnabled: () => false,
  isBiometricOverlayEnabled: () => false,
  isMicUpSeriesEnabled: () => false,
}));

vi.mock('@/components/preflight/ViewerPreflight', () => ({
  ViewerPreflight: () => <div data-testid="viewer-preflight" />,
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
  getSupabaseClient: () => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn(async (name: string) => {
      if (name === 'get_active_broadcast') {
        return {
          data: {
            is_live: true,
            stream_url: 'https://stream.example/live.m3u8',
            title: 'Open Broadcast',
            active_game_id: activeBroadcastGameId,
            live_started_at: '2026-05-06T00:00:00Z',
            requires_payment: false,
            is_subscribed: false,
            has_entitlement: true,
            user_registered: true,
          },
          error: null,
        };
      }
      if (name === 'get_leaderboards') {
        return { data: { leaders: [] }, error: null };
      }
      return { data: null, error: null };
    }),
  }),
}));

vi.mock('@/lib/api/client', () => ({
  getAuthToken: vi.fn(async () => null),
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes('/products')) return { ok: true, data: [] };
    if (path.includes('/reactions')) return { ok: true, fire: 0, heart: 0, clap: 0 };
    return { ok: true };
  }),
}));

vi.mock('@/components/LiveStreamPlayer', () => ({
  LiveStreamPlayer: ({
    game,
    serverGrantedAccess,
  }: {
    game: { id: string };
    serverGrantedAccess?: boolean;
  }) => (
    <div data-testid="live-player">
      game:{game.id};serverGranted:{String(serverGrantedAccess)}
    </div>
  ),
}));

vi.mock('@/lib/api/public', () => ({
  fetchPublicHome: vi.fn(async () => ({
    ok: true,
    data: { liveGames: publicHomeLiveGames, upcomingGames: [] },
  })),
}));

vi.mock('@/lib/api/stream', () => ({
  fetchPublicStreamStatus: vi.fn(async () => ({
    ok: true,
    isLive: true,
    title: 'Open Broadcast',
    viewerCount: 0,
  })),
  fetchStreamComments: vi.fn(async () => ({ ok: true, comments: [] })),
  postStreamComment: vi.fn(async () => ({ ok: true })),
  moderateStreamComment: vi.fn(async () => ({ ok: true })),
  resetStreamReactions: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.useRealTimers();
  publicHomeLiveGames = [];
  activeBroadcastGameId = null;
  viewerPreflightEnabled = false;
});

describe('Live page server-granted open broadcast', () => {
  it('passes server-granted access into the broadcast player for registered fans', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } })}>
        <MemoryRouter future={ROUTER_FUTURE}>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('game:broadcast');
      expect(screen.getByTestId('live-player').textContent).toContain('serverGranted:true');
    });
  });

  it('keeps open broadcasts on the broadcast session route when a scorekeeper-created live score row exists', async () => {
    publicHomeLiveGames = [{
      id: '11111111-1111-4111-8111-111111111111',
      league_id: 'sbbl',
      home_team: { id: 'home-1', name: 'Home', league_id: 'sbbl' },
      away_team: { id: 'away-1', name: 'Away', league_id: 'sbbl' },
      status: 'live',
      home_score: 12,
      away_score: 10,
      starts_at: '2026-05-10T20:00:00Z',
    }];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } })}>
        <MemoryRouter future={ROUTER_FUTURE}>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('game:broadcast');
      expect(screen.getByTestId('live-player').textContent).toContain('serverGranted:true');
    });
  });

  it('does not let viewer preflight block server-granted open broadcasts with live score rows', async () => {
    viewerPreflightEnabled = true;
    publicHomeLiveGames = [{
      id: '11111111-1111-4111-8111-111111111111',
      league_id: 'sbbl',
      home_team: { id: 'home-1', name: 'Home', league_id: 'sbbl' },
      away_team: { id: 'away-1', name: 'Away', league_id: 'sbbl' },
      status: 'live',
      starts_at: '2026-05-10T20:00:00Z',
    }];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } })}>
        <MemoryRouter future={ROUTER_FUTURE}>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('viewer-preflight')).not.toBeInTheDocument();
      expect(screen.getByTestId('live-player').textContent).toContain('game:broadcast');
    });
  });

  it('keeps broadcast-oracle playback universal even when active_game_id is present', async () => {
    activeBroadcastGameId = '22222222-2222-4222-8222-222222222222';

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } })}>
        <MemoryRouter future={ROUTER_FUTURE}>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('live-player').textContent).toContain('game:broadcast');
      expect(screen.getByTestId('live-player').textContent).toContain('serverGranted:true');
    });
  });
});
