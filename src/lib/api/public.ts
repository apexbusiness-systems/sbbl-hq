export type PublicTeam = {
  id: string;
  name: string;
  league_code: string;
  league_name: string;
  season_name: string;
  division_name: string | null;
  roster_count: number;
};

export type PublicGame = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  scheduled_at: string | null;
  venue: string | null;
  court: string | null;
  league_code: string;
  home_team: PublicTeam | null;
  away_team: PublicTeam | null;
};

export type PublicHomeData = {
  ok: boolean;
  league: { id: string; name: string; code: string } | null;
  season: { id: string; name: string; status: string } | null;
  teams: PublicTeam[];
  totalTeams: number;
  totalRostered: number;
  liveGames: PublicGame[];
  upcomingGames: PublicGame[];
  recentGames: PublicGame[];
  totalGames: number;
  leagues: Array<{ id: string; name: string; code: string }>;
};

const API_BASE = import.meta.env.VITE_WORKER_API_BASE?.trim() || '';

export async function fetchPublicHome(leagueCode: string): Promise<PublicHomeData> {
  const resp = await fetch(`${API_BASE}/api/public/home?league=${encodeURIComponent(leagueCode)}`);
  if (!resp.ok) throw new Error(`public_home_${resp.status}`);
  return resp.json() as Promise<PublicHomeData>;
}
