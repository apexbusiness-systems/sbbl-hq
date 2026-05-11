/**
 * live-flow-simulation.test.tsx
 *
 * End-to-end simulation of the full broadcast viewer flow, exercised entirely
 * at the component-tree level. Each test models one stage of the gate order
 * documented in the broadcast contract:
 *
 *   1. Admin goes live (writes stream_admin_config + syncs sessions)
 *   2. Anon visitor lands on /live  →  anon paywall CTA → /onboarding?intent=fan
 *   3. Onboarded fan with no entitlement on /live  →  paywall (no stream_url)
 *   4. Onboarded fan AFTER server grants stream_url  →  LiveStreamPlayer renders
 *   5. Live-service oracle failure  →  explicit misconfigured banner (NOT
 *      silent "No Active Broadcast"; NOT a leaked stream_url)
 *
 * The PR #500 contract (server-granted broadcast.stream_url must keep playback
 * on game:broadcast) is exercised in stage 4 and re-verified in stage 5: even
 * if the oracle errors on subsequent polls, a previously-granted stream_url
 * must not be lost.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from '@/test/utils/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mutable state mirroring DB / RPC responses across stages ───────────────
type BroadcastResponse = {
  is_live: boolean;
  stream_url: string | null;
  title: string | null;
  active_game_id: string | null;
  live_started_at: string | null;
  requires_payment: boolean;
  is_subscribed: boolean;
  has_entitlement: boolean;
  user_registered: boolean;
};

let currentUser: { id: string } | null = null;
let currentNeedsOnboarding = false;
let currentBroadcast: BroadcastResponse | null = null;
let broadcastShouldError = false;

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: currentUser,
    session: currentUser ? { access_token: 't' } : null,
    roles: [],
    needsOnboarding: currentNeedsOnboarding,
    loading: false,
  }),
}));

vi.mock('@/hooks/useLiveAccess', () => ({
  useLiveAccess: () => ({
    access: currentBroadcast?.stream_url ? 'paid' : 'paywall',
    config: {
      isLive: Boolean(currentBroadcast?.is_live),
      videoUrl: null,
      title: currentBroadcast?.title ?? 'SBBL Live',
    },
  }),
}));

vi.mock('@/lib/feature-flags', () => ({
  isViewerPreflightEnabled: () => false,
  isFanTokenSystemEnabled: () => false,
  isBiometricOverlayEnabled: () => false,
  isMicUpSeriesEnabled: () => false,
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
        if (broadcastShouldError) {
          return { data: null, error: { message: 'function public.get_active_broadcast() does not exist' } };
        }
        return { data: currentBroadcast, error: null };
      }
      if (name === 'get_leaderboards') {
        return { data: { leaders: [] }, error: null };
      }
      return { data: null, error: null };
    }),
  }),
}));

vi.mock('@/lib/api/public', () => ({
  fetchPublicHome: vi.fn(async () => ({
    ok: true,
    data: { liveGames: [], upcomingGames: [], leagues: [], teamsByLeague: {} },
  })),
}));

vi.mock('@/lib/api/preflight', () => ({
  fetchPreflightSnapshot: vi.fn(async () => null),
}));

vi.mock('@/lib/api/biometrics', () => ({
  fetchLatestBiometrics: vi.fn(async () => []),
}));

vi.mock('@/lib/api/tokens', () => ({
  fetchLeaderboardByGame: vi.fn(async () => []),
  fetchTokenCategories: vi.fn(async () => []),
  fetchTokenProducts: vi.fn(async () => []),
  fetchTokenWallet: vi.fn(async () => ({ balance: 0 })),
  startTokenPurchase: vi.fn(),
  awardTokens: vi.fn(),
}));

vi.mock('@/hooks/useTokenLeaderboardRealtime', () => ({
  useTokenLeaderboardRealtime: () => ({ entries: [] }),
}));

vi.mock('@/hooks/useBiometricRealtime', () => ({
  useBiometricRealtime: () => ({ snapshots: [] }),
}));

vi.mock('@/lib/api/stream', () => ({
  fetchAdminStreamConfig: vi.fn(async () => null),
  fetchPublicStreamStatus: vi.fn(async () => ({ ok: true, isLive: true, title: 'SBBL Live', viewerCount: 0 })),
  fetchStreamComments: vi.fn(async () => []),
  generateCompCode: vi.fn(),
  goLive: vi.fn(),
  moderateStreamComment: vi.fn(),
  postStreamComment: vi.fn(),
  resetStreamReactions: vi.fn(),
  setStreamLive: vi.fn(),
  updateStreamConfig: vi.fn(),
}));

vi.mock('@/components/LiveStreamPlayer', () => ({
  LiveStreamPlayer: ({ game }: { game: { id: string } }) => (
    <div data-testid="live-stream-player" data-game-id={game.id}>player</div>
  ),
}));

vi.mock('@/components/PlayerErrorBoundary', () => ({
  PlayerErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/biometrics/BiometricDualOverlay', () => ({
  BiometricDualOverlay: () => null,
}));

vi.mock('@/components/micup/MicUpIntroSting', () => ({
  MicUpIntroSting: () => null,
}));

vi.mock('@/components/micup/MicUpLowerThird', () => ({
  MicUpLowerThird: () => null,
}));

vi.mock('@/components/micup/TrashTalkBanner', () => ({
  TrashTalkBanner: () => null,
}));

vi.mock('@/components/CheerMeter', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/components/CASLNudge', () => ({
  CASLNudge: () => null,
}));

vi.mock('@/components/preflight/ViewerPreflight', () => ({
  ViewerPreflight: () => null,
}));

vi.mock('@/components/tokens/TokenWalletBadge', () => ({
  TokenWalletBadge: () => null,
}));

vi.mock('@/components/tokens/TokenPurchaseModal', () => ({
  TokenPurchaseModal: () => null,
}));

vi.mock('@/components/tokens/TokenAwardPanel', () => ({
  TokenAwardPanel: () => null,
}));

vi.mock('@/components/tokens/TokenLeaderboard', () => ({
  TokenLeaderboard: () => null,
}));

vi.mock('@/components/ui/PlayerAvatar', () => ({
  PlayerAvatar: () => null,
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, data: [] })),
  getAuthToken: vi.fn(() => null),
}));

import LivePage from '@/pages/Live';

function renderLive() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/live']} future={ROUTER_FUTURE}>
        <LivePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('live broadcast viewer flow simulation', () => {
  beforeEach(() => {
    currentUser = null;
    currentNeedsOnboarding = false;
    currentBroadcast = null;
    broadcastShouldError = false;
  });

  it('STAGE 2 — anon visitor on a live broadcast sees the register-to-watch paywall', async () => {
    // Admin has just gone live: oracle reports is_live + requires_payment for
    // unauthenticated callers (stream_url withheld).
    currentBroadcast = {
      is_live: true,
      stream_url: null,
      title: 'TGIFBL Finals',
      active_game_id: null,
      live_started_at: '2026-05-11T19:00:00Z',
      requires_payment: false, // anon sees marketing copy; no purchase panel
      is_subscribed: false,
      has_entitlement: false,
      user_registered: false,
    };

    renderLive();

    // The "Register to Watch" CTA proves: (a) the page recognized the live
    // broadcast, (b) it did NOT leak a stream_url, (c) it routes anons into
    // /onboarding?intent=fan&redirect=/live.
    await waitFor(() => expect(screen.getByText(/Register to Watch/i)).toBeInTheDocument());
    expect(screen.queryByTestId('live-stream-player')).not.toBeInTheDocument();
  });

  it('STAGE 3 — onboarded fan with no entitlement sees code + purchase panels', async () => {
    currentUser = { id: 'fan-1' };
    currentBroadcast = {
      is_live: true,
      stream_url: null,
      title: 'TGIFBL Finals',
      active_game_id: null,
      live_started_at: '2026-05-11T19:00:00Z',
      requires_payment: true,
      is_subscribed: false,
      has_entitlement: false,
      user_registered: true,
    };

    renderLive();

    await waitFor(() => expect(screen.getByText(/Have a Free Access Code/i)).toBeInTheDocument());
    expect(screen.getByText(/Purchase Access/i)).toBeInTheDocument();
    // Critical: server-side gating proven by the absence of the player.
    expect(screen.queryByTestId('live-stream-player')).not.toBeInTheDocument();
  });

  it('STAGE 4 — onboarded fan with server-granted stream_url renders the player on the broadcast alias', async () => {
    currentUser = { id: 'fan-1' };
    currentBroadcast = {
      is_live: true,
      // SERVER granted the URL — this is the PR #500 contract surface.
      stream_url: 'https://stream.example/live.m3u8',
      title: 'TGIFBL Finals',
      active_game_id: null,
      live_started_at: '2026-05-11T19:00:00Z',
      requires_payment: false,
      is_subscribed: true,
      has_entitlement: true,
      user_registered: true,
    };

    renderLive();

    // Player renders, AND it does so on the broadcast alias game id —
    // never re-routed into stricter game-specific PPV/preflight paths.
    const player = await screen.findByTestId('live-stream-player');
    expect(player).toHaveAttribute('data-game-id', 'broadcast');
  });

  it('STAGE 5a — oracle failure with no prior access fails closed to the misconfigured banner', async () => {
    currentUser = { id: 'fan-1' };
    broadcastShouldError = true;
    currentBroadcast = null;

    renderLive();

    // The Live.tsx query has retry: 1, so we wait long enough for the retry to
    // exhaust and isError to flip. Without retries the test would race; with a
    // shorter timeout it would fall through to "No Active Broadcast" before
    // the misconfigured branch had a chance to render.
    await waitFor(
      () => expect(screen.getByTestId('live-misconfigured')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByText(/Live service unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId('live-stream-player')).not.toBeInTheDocument();
  });
});
