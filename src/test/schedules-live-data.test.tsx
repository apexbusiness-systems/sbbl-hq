import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SchedulesPage from '@/pages/Schedules';

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ activeLeague: 'all', setActiveLeague: vi.fn() }),
}));

const fetchPublicSchedule = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/public', () => ({ fetchPublicSchedule }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SchedulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchedulesPage live data states', () => {
  it('shows the empty state when no live schedule exists', async () => {
    fetchPublicSchedule.mockResolvedValueOnce({ ok: true, data: [] });
    renderPage();
    expect(await screen.findByText(/No games scheduled/i)).toBeInTheDocument();
  });

  it('shows the error state when the live schedule API fails', async () => {
    fetchPublicSchedule.mockRejectedValueOnce(new Error('api offline'));
    renderPage();
    expect(await screen.findByText(/Unable to load schedules/i)).toBeInTheDocument();
  });

  it('renders live schedule rows from the API', async () => {
    fetchPublicSchedule.mockResolvedValueOnce({ ok: true, data: [{
      starts_at: '2026-06-01T18:00:00Z',
      league_id: 'sbbl',
      week: 5,
      venue: 'Live Gym',
      address: '1 Court St',
      court: 'Court A',
      home_team_name: 'Live Home',
      away_team_name: 'Live Away',
    }] });
    renderPage();
    expect(await screen.findByText('Live Home')).toBeInTheDocument();
    expect(screen.getByText('Live Away')).toBeInTheDocument();
    expect(screen.getByText(/Week 5/i)).toBeInTheDocument();
  });

  it('does not import the stale Week 4 production fixture', async () => {
    const moduleText = await import('node:fs/promises').then((fs) => fs.readFile('src/pages/Schedules.tsx', 'utf8'));
    expect(moduleText).not.toContain('SBBL_WEEK4_MAY_10_2026');
    expect(moduleText).not.toContain('sbblWeek4Schedule');
  });
});
