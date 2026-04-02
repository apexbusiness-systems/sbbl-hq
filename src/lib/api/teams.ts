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
  // stats is always present — worker always returns zeroed object even with no games
  stats: TeamStats;
};

/**
 * Fetch all published teams from the worker.
 *
 * The worker endpoint GET /api/teams accepts an optional `leagueId` query param
 * that can be either a UUID or a league code string (e.g. "SBBL").
 *
 * We always fetch ALL teams and let the UI filter client-side so that
 * the React Query cache covers the full dataset — switching league filters
 * never causes an extra network round-trip.
 *
 * The query key in Teams.tsx must always be ['teams'] (no league suffix) so
 * the single cached response is shared across filter switches.
 */
export async function fetchTeams(): Promise<{ ok: boolean; teams: TeamCard[] }> {
  try {
    return await apiFetch<{ ok: boolean; teams: TeamCard[] }>('/api/teams');
  } catch (err) {
    return { ok: false, teams: [] };
  }

}
