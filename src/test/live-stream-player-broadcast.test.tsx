import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveStreamPlayer } from '@/components/LiveStreamPlayer';
import { toPlayableUrl } from '@/lib/stream/url-detector';

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock('react-player', () => ({
  default: ({ url }: { url: string }) => <div data-testid="react-player">{url}</div>,
}));

vi.mock('@/components/WhepPlayer', () => ({
  WhepPlayer: () => <div data-testid="whep-player" />,
}));

vi.mock('@/hooks/use-turnstile', () => ({
  useTurnstile: () => ({ containerRef: { current: null }, resolveToken: vi.fn(async () => 'captcha') }),
}));

vi.mock('@/hooks/use-streamforge', () => ({
  useStreamForge: () => ({
    reportEvent: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  }),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: apiFetchMock,
}));

describe('LiveStreamPlayer broadcast lane', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/streams/broadcast/session') {
        return {
          playback: { url: 'https://cdn.example.com/live.m3u8', heartbeatIntervalSec: 120 },
          session: { id: 'sess-broadcast-1', maxExpiresAt: new Date(Date.now() + 3600_000).toISOString() },
        };
      }
      if (path === '/api/streams/broadcast/session/end') return { ok: true };
      return { ok: true };
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('starts playback for signed-in fan without entitlement check and uses broadcast session route', async () => {
    render(
      <LiveStreamPlayer
        game={{
          id: 'broadcast',
          leagueId: 'sbbl',
          homeTeam: { id: 'h', name: 'SBBL', leagueId: 'sbbl', division: 'N/A', record: { wins: 0, losses: 0 } },
          awayTeam: { id: 'a', name: 'Live', leagueId: 'sbbl', division: 'N/A', record: { wins: 0, losses: 0 } },
          venue: 'SBBL HQ',
          court: 'Main Feed',
          date: new Date().toISOString(),
          time: new Date().toISOString(),
          status: 'live',
          score: { home: 0, away: 0 },
          ppvPrice: 0,
        }}
        userId="fan-1"
        roles={['fan']}
        hasPremiumPlayerAccess={false}
        isStreamLive
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/streams/broadcast/session',
        expect.objectContaining({ method: 'POST' }),
        null,
      );
    });

    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/streams/broadcast/access', expect.anything(), expect.anything());
    expect(screen.queryByText(/Purchase Access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate Fan Invite/i)).not.toBeInTheDocument();
  });

  it('keeps YouTube and Twitch playable URL normalization unchanged', () => {
    expect(toPlayableUrl('https://youtu.be/dQw4w9WgXcQ').url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(toPlayableUrl('https://player.twitch.tv/?channel=sbblhq&parent=sbbl-hq.icu').url).toBe('https://www.twitch.tv/sbblhq');
  });
});
