import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LivePage from '@/pages/Live';

const { updateStreamConfigMock, setStreamLiveMock } = vi.hoisted(() => ({
  updateStreamConfigMock: vi.fn(async () => ({ ok: true })),
  setStreamLiveMock: vi.fn(async () => ({ ok: true, isLive: true })),
}));

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
    config: { isLive: false, title: 'Camera Feed', collectionId: '' },
  })),
  fetchPublicStreamStatus: vi.fn(async () => ({ ok: true, isLive: false, title: 'Camera Feed', viewerCount: 0 })),
  fetchStreamComments: vi.fn(async () => ({ ok: true, comments: [] })),
  postStreamComment: vi.fn(async () => ({ ok: true })),
  setStreamLive: setStreamLiveMock,
  updateStreamConfig: updateStreamConfigMock,
  generateCompCode: vi.fn(async () => ({ ok: true, code: 'CODE', expiresAt: new Date().toISOString() })),
}));

describe('Live page YouTube baseline validation', () => {
  it('blocks non-YouTube URLs and does not submit go-live update', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Stream controls')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Stream controls'));
    const input = await screen.findByPlaceholderText('https://www.youtube.com/watch?v=...');
    fireEvent.change(input, { target: { value: 'https://vimeo.com/12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go Live' }));

    await waitFor(() => {
      expect(screen.getByText('Only YouTube Live URLs are allowed in baseline mode.')).toBeInTheDocument();
    });
    expect(updateStreamConfigMock).not.toHaveBeenCalled();
    expect(setStreamLiveMock).not.toHaveBeenCalled();
  });
});
