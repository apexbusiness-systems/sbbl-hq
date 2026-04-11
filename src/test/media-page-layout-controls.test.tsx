import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MediaPage from '@/pages/Media';
let mockRoles: string[] = [];

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ activeLeague: 'sbbl', setActiveLeague: vi.fn() }),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url.includes('/ops/media-layout/')) {
      return { ok: true, data: { section: { id: '1', slug: 'media-page-main', title: 'Main', capacity: 9, updatedAt: '2026-01-01' }, items: [] } };
    }
    return { ok: true, data: [{ id: 'a', title: 'Shot', type: 'photo', thumbnail: '/a.jpg', leagueId: 'sbbl', status: 'published', date: '2026-01-01' }] };
  }),
}));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ loading: false, roles: mockRoles }),
}));

const renderPage = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MediaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('media page layout admin controls', () => {
  it('hides admin controls for non-admin users', async () => {
    mockRoles = [];
    renderPage();
    expect(await screen.findByText('Media')).toBeInTheDocument();
    expect(screen.queryByText('Media Layout Manager')).not.toBeInTheDocument();
  });

  it('shows admin controls for super admins', async () => {
    mockRoles = ['super_admin'];
    renderPage();
    expect(await screen.findByText('Media Layout Manager')).toBeInTheDocument();
  });
});
