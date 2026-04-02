import { apiFetch } from '@/lib/api/client';

export async function fetchPublicSchedule(leagueId?: string) {
  const params = leagueId && leagueId !== 'all' ? `?leagueId=${leagueId}` : '';
  return apiFetch<{ ok: boolean; data: unknown[] }>(`/api/public/schedule${params}`);
}

export async function fetchPublicPotg() {
  return apiFetch<{ ok: boolean; data: unknown[] }>('/api/public/potg');
}

export type PublicHomeData = {
  hero: unknown;
  featured_games: unknown[];
  news: unknown[];
  totalTeams?: number;
  season?: { name: string };
  totalGames?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teams?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentGames?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upcomingGames?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  liveGames?: any[];
  totalRostered?: number;
};

export async function fetchPublicHome(leagueCode?: string) {
  const params = leagueCode ? `?league=${leagueCode}` : '';
  return apiFetch<{ ok: boolean; data: PublicHomeData }>(`/api/public/home${params}`);
}
