import { apiFetch } from '@/lib/api/client';

export async function fetchPublicSchedule(leagueId?: string) {
  const params = leagueId && leagueId !== 'all' ? `?leagueId=${leagueId}` : '';
  return apiFetch<{ ok: boolean; data: any[] }>(`/api/public/schedule${params}`);
}

export async function fetchPublicPotg() {
  return apiFetch<{ ok: boolean; data: any[] }>('/api/public/potg');
}

export type PublicHomeData = {
  hero: any;
  featured_games: any[];
  news: any[];
};

export async function fetchPublicHome() {
  return apiFetch<{ ok: boolean; data: PublicHomeData }>('/api/public/home');
}
