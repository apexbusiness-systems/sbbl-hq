import { apiFetch } from '@/lib/api/client';

export type PlayerProfile = {
  id: string;
  user_id: string;
  jersey_number: number | null;
  position: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type CoachProfile = {
  id: string;
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type TeamStats = {
  wins: number;
  losses: number;
  gamesPlayed: number;
  ptsFor: number;
  ptsAgainst: number;
  winPct: string;
  diff: number;
};

export type TeamCard = {
  id: string;
  name: string;
  league_code: string;
  league_name: string;
  season_name: string;
  division_name: string | null;
  roster_count: number;
  players: PlayerProfile[];
  coaches: CoachProfile[];
  stats: TeamStats;
};

export async function fetchTeams(leagueId?: string) {
  const query = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
  return apiFetch<{ ok: boolean; teams: TeamCard[] }>(`/api/teams${query}`);
}
