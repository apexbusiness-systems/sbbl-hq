import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from '@/test/utils/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';

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
    rpc: vi.fn(async (name: string) => {
      if (name === 'get_active_broadcast') {
        return {
          data: {
            is_live: true,
            stream_url: 'https://stream.example/live.m3u8',
            title: 'Open Broadcast',
            active_game_id: null,
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
    data: { liveGames: [], upcomingGames: [] },
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
});
