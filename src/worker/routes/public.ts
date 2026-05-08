/**
 * Public API route handlers — no auth required.
 *
 * Extracted from src/worker/index.ts to reduce monolith size.
 * The main Worker index.ts still references these via the route table.
 */
import type { HandlerCtx } from "../shared";
import { json } from "../shared";

export async function handlePublicConfig({ env }: HandlerCtx) {
  return json({
    ok: true,
    appName: "SBBL HQ",
    defaultLeague: "SBBL",
    supabaseUrl: env.SUPABASE_URL ?? null,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY ?? null,
  });
}

export async function handlePublicSchedule({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  let q = admin.from("schedule_slots").select("*").eq("status", "upcoming");
  if (leagueId) {
    q = q.eq("league_id", leagueId);
  }
  const { data, error } = await q.order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

export async function handlePublicPotg({ admin }: HandlerCtx) {
  const { data, error } = await admin
    .from("media_publications")
    .select("id,title,surface,league_id,status,render_payload,published_at,created_at")
    .eq("surface", "potg")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return json({ ok: true, data });
}

export async function handlePublicHome({ req, admin }: HandlerCtx) {
  const url = new URL(req.url);
  const leagueCode = (url.searchParams.get("league") ?? "SBBL").toUpperCase();

  const [leaguesRes, teamsRes, gamesRes, seasonsRes] = await Promise.all([
    admin.from("leagues").select("id,name,code").order("name"),
    admin
      .from("teams")
      .select(
        "id,name,leagues(name,code),seasons(name),divisions(name),players(id)",
      )
      .eq("status", "published")
      .limit(200),
    admin
      .from("games")
      .select(
        "id,home_team_id,away_team_id,status,home_score,away_score,scheduled_at,venue_id,venues(name),courts(name),season_id,seasons(league_id,leagues(code))",
      )
      .in("status", ["live", "upcoming", "final"])
      .order("scheduled_at", { ascending: true })
      .limit(50),
    admin
      .from("seasons")
      .select("id,name,league_id,leagues(code),status")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const leagues = (leaguesRes.data ?? []) as Array<{
    id: string;
    name: string;
    code: string;
  }>;
  const activeLeague =
    leagues.find((l) => l.code?.toUpperCase() === leagueCode) ??
    leagues[0] ??
    null;
  const activeLeagueId = activeLeague?.id ?? null;

  const allTeams = (teamsRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      league_code: (
        (row.leagues as { code?: string } | null)?.code ?? ""
      ).toUpperCase(),
      league_name: String(
        (row.leagues as { name?: string } | null)?.name ?? "",
      ),
      season_name: String(
        (row.seasons as { name?: string } | null)?.name ?? "",
      ),
      division_name: (row.divisions as { name?: string } | null)?.name ?? null,
      roster_count: Array.isArray(row.players) ? row.players.length : 0,
    }),
  );
  const leagueTeams = activeLeagueId
    ? allTeams.filter((t) => t.league_code === leagueCode)
    : allTeams;

  const allGames = (gamesRes.data ?? []).map(
    (row: Record<string, unknown>) => {
      const seasons = row.seasons as {
        league_id?: string;
        leagues?: { code?: string };
      } | null;
      return {
        id: String(row.id),
        home_team_id: row.home_team_id as string | null,
        away_team_id: row.away_team_id as string | null,
        status: String(row.status ?? "upcoming"),
        home_score: row.home_score as number | null,
        away_score: row.away_score as number | null,
        scheduled_at: row.scheduled_at as string | null,
        venue: (row.venues as { name?: string } | null)?.name ?? null,
        court: (row.courts as { name?: string } | null)?.name ?? null,
        league_code: (seasons?.leagues?.code ?? "").toUpperCase(),
      };
    },
  );
  const leagueGames = allGames.filter((g) => g.league_code === leagueCode);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const enrichGame = (g: (typeof leagueGames)[0]) => ({
    ...g,
    home_team: teamMap.get(g.home_team_id ?? "") ?? null,
    away_team: teamMap.get(g.away_team_id ?? "") ?? null,
  });

  const liveGames = leagueGames
    .filter((g) => g.status === "live")
    .map(enrichGame);
  const upcomingGames = leagueGames
    .filter((g) => g.status === "upcoming")
    .slice(0, 5)
    .map(enrichGame);
  const recentGames = leagueGames
    .filter((g) => g.status === "final")
    .slice(0, 5)
    .map(enrichGame);

  // FAST PATH: If we resolved activeLeagueId, match by ID directly (O(1) comparison vs string allocations)
  const activeSeason = (seasonsRes.data ?? []).find((s: Record<string, unknown>) =>
    activeLeagueId
      ? s.league_id === activeLeagueId
      : ((s.leagues as { code?: string } | null)?.code ?? "").toUpperCase() ===
        leagueCode,
  ) as { id: string; name: string; status: string } | undefined;

  return json({
    ok: true,
    league: activeLeague,
    season: activeSeason
      ? {
          id: activeSeason.id,
          name: activeSeason.name,
          status: activeSeason.status,
        }
      : null,
    teams: leagueTeams,
    totalTeams: leagueTeams.length,
    totalRostered: leagueTeams.reduce((sum, t) => sum + t.roster_count, 0),
    liveGames,
    upcomingGames,
    recentGames,
    totalGames: leagueGames.length,
    leagues: leagues.map((l) => ({ id: l.id, name: l.name, code: l.code })),
  });
}
