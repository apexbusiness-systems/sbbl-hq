import { forwardRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import type { Game } from '@/types';

const {
  apiFetchMock,
  reactPlayerRenderSpy,
  reportEventMock,
  recordSuccessMock,
  recordFailureMock,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  reactPlayerRenderSpy: vi.fn(),
  reportEventMock: vi.fn(),
  recordSuccessMock: vi.fn(),
  recordFailureMock: vi.fn(),
}));

vi.mock('react-player', () => {
  const MockReactPlayer = forwardRef<HTMLDivElement, Record<string, unknown>>((props, _ref) => {
    reactPlayerRenderSpy(props);
    return <div data-testid="react-player" />;
  });
  MockReactPlayer.displayName = 'ReactPlayerMock';
  return { default: MockReactPlayer };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/hooks/use-turnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null },
    resolveToken: vi.fn(async () => 'turnstile-token'),
  }),
}));

vi.mock('@/hooks/use-streamforge', () => ({
  useStreamForge: () => ({
    reportEvent: reportEventMock,
    recordSuccess: recordSuccessMock,
    recordFailure: recordFailureMock,
  }),
}));

vi.mock('@/components/WhepPlayer', () => ({
  WhepPlayer: () => <div data-testid="whep-player" />,
}));

vi.mock('@/components/ui/LeagueBadge', () => ({
  LeagueBadge: () => <div data-testid="league-badge" />,
}));

vi.mock('@/assets/game-action.svg', () => ({
  default: 'game-action.svg',
}));

const baseGame = {
  id: 'game-1',
  leagueId: 'league-1',
  stream_url: '',
  venue: 'SBBL Arena',
  court: 'Court 1',
  homeTeam: { name: 'Home' },
  awayTeam: { name: 'Away' },
  score: { home: 0, away: 0 },
} as Game;

type MockReactPlayerProps = {
  url?: string;
  muted?: boolean;
  controls?: boolean;
  config: {
    twitch: {
      options: {
        muted?: boolean;
        parent?: string[];
      };
    };
  };
};

function mockPlaybackSession(url: string) {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.endsWith('/session')) {
      return {
        playback: { url, heartbeatIntervalSec: 30 },
        session: { id: 'session-1' },
      };
    }
    if (path.endsWith('/session/heartbeat')) {
      return {};
    }
    if (path.endsWith('/session/end')) {
      return {};
    }
    throw new Error(`Unexpected apiFetch call: ${path}`);
  });
}

function getLastReactPlayerProps(): MockReactPlayerProps {
  const lastCall = reactPlayerRenderSpy.mock.calls[reactPlayerRenderSpy.mock.calls.length - 1];
  return (lastCall?.[0] ?? {}) as MockReactPlayerProps;
}

describe('LiveStreamPlayer provider behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Twitch with muted autoplay, explicit parents, and native provider chrome', async () => {
    localStorage.setItem('sbbl:stream-device-token:v1', 'device-token-1234567890');
    mockPlaybackSession('https://www.twitch.tv/sbblhq');

    render(
      <LiveStreamPlayer
        game={baseGame}
        userId="user-1"
        roles={['player']}
        hasPremiumPlayerAccess={true}
        isStreamLive={true}
      />,
    );

    await waitFor(() => {
      expect(reactPlayerRenderSpy).toHaveBeenCalled();
    });

    const props = getLastReactPlayerProps();
    expect(props.url).toBe('https://www.twitch.tv/sbblhq');
    expect(props.muted).toBe(true);
    expect(props.controls).toBe(true);
    expect(props.config.twitch.options.muted).toBe(true);
    expect(props.config.twitch.options.parent).toEqual(
      expect.arrayContaining(['sbbl-hq.icu', 'www.sbbl-hq.icu', 'localhost']),
    );
    expect(screen.queryByTestId('provider-click-shield')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stream-custom-controls')).not.toBeInTheDocument();
  });

  it('keeps the click shield and custom chrome isolated to Facebook embeds', async () => {
    localStorage.setItem('sbbl:stream-device-token:v1', 'device-token-1234567890');
    mockPlaybackSession('https://www.facebook.com/sbbl/videos/1234567890');

    render(
      <LiveStreamPlayer
        game={baseGame}
        userId="user-1"
        roles={['player']}
        hasPremiumPlayerAccess={true}
        isStreamLive={true}
      />,
    );

    await waitFor(() => {
      expect(reactPlayerRenderSpy).toHaveBeenCalled();
    });

    const props = getLastReactPlayerProps();
    expect(props.url).toBe('https://www.facebook.com/sbbl/videos/1234567890');
    expect(props.controls).toBe(false);
    expect(screen.getByTestId('provider-click-shield')).toBeInTheDocument();
    expect(screen.getByTestId('stream-custom-controls')).toBeInTheDocument();
  });
});
