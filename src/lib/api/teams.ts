import { apiFetch } from '@/lib/api/client';

export type TeamCard = {
  id: string;
  name: string;
  league_name: string;
  season_name: string;
  division_name: string | null;
  roster_count: number;
};

export async function fetchTeams(leagueId?: string) {
  const query = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
  return apiFetch<{ ok: boolean; teams: TeamCard[] }>(`/api/teams${query}`);
}
