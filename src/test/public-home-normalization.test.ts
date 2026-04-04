import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('fetchPublicHome normalization', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('wraps flat Worker response into { ok, data }', async () => {
    // Mock the apiFetch to return the flat Worker shape
    vi.doMock('@/lib/api/client', () => ({
      apiFetch: vi.fn().mockResolvedValue({
        ok: true,
        league: { id: 'l1', name: 'SBBL', code: 'SBBL' },
        season: { id: 's1', name: '2026 Spring', status: 'active' },
        teams: [{ id: 't1', name: 'Team A' }],
        totalTeams: 1,
        totalRostered: 12,
        liveGames: [],
        upcomingGames: [{ id: 'g1', status: 'upcoming' }],
        recentGames: [],
        totalGames: 5,
        leagues: [{ id: 'l1', name: 'SBBL', code: 'SBBL' }],
      }),
    }));

    const { fetchPublicHome } = await import('@/lib/api/public');
    const result = await fetchPublicHome('SBBL');

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.totalTeams).toBe(1);
    expect(result.data.season?.name).toBe('2026 Spring');
    expect(result.data.teams).toHaveLength(1);
    expect(result.data.upcomingGames).toHaveLength(1);
    expect(result.data.leagues).toHaveLength(1);
    // Verify 'ok' is NOT inside data
    expect((result.data as Record<string, unknown>).ok).toBeUndefined();
  });
});
