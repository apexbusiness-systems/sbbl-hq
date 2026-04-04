import { apiFetch } from '@/lib/api/client';

export async function fetchPublicSchedule(leagueId?: string) {
  const params = leagueId && leagueId !== 'all' ? `?leagueId=${leagueId}` : '';
  return apiFetch<{ ok: boolean; data: unknown[] }>(`/api/public/schedule${params}`);
}

export async function fetchPublicPotg() {
  return apiFetch<{ ok: boolean; data: unknown[] }>('/api/public/potg');
}

/** Matches the actual shape returned by handlePublicHome in the Worker. */
export type PublicHomeData = {
  league?: { id: string; name: string; code: string } | null;
  season?: { id: string; name: string; status: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teams?: any[];
  totalTeams?: number;
  totalRostered?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  liveGames?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upcomingGames?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentGames?: any[];
  totalGames?: number;
  leagues?: Array<{ id: string; name: string; code: string }>;
};

/**
 * Fetch public home data. The Worker returns a flat payload:
 *   { ok, league, season, teams, totalTeams, ... }
 * This wrapper normalizes it into { ok, data: PublicHomeData } so callers
 * can access result.data consistently.
 */
export async function fetchPublicHome(leagueCode?: string) {
  const params = leagueCode ? `?league=${leagueCode}` : '';
  const raw = await apiFetch<Record<string, unknown>>(`/api/public/home${params}`);
  // The Worker returns all fields at the top level (no `data` wrapper).
  // Normalize into { ok, data } so every caller can use result.data.
  const { ok, ...rest } = raw;
  return { ok: ok as boolean, data: rest as PublicHomeData };
}
