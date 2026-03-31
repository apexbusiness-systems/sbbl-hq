export type TeamDirectoryCard = {
  id: string;
  name: string;
  league_code: string;
  league_name: string;
  season_name: string;
  division_name: string | null;
  roster_count: number;
};

export function mapTeamDirectoryRow(row: Record<string, unknown>): TeamDirectoryCard {
  const rosterSource = Array.isArray(row.team_memberships)
    ? row.team_memberships
    : Array.isArray(row.players)
      ? row.players
      : [];

  return {
    id: String(row.id),
    name: String(row.name),
    league_code: ((row.leagues as { code?: string } | null)?.code ?? '').toUpperCase(),
    league_name: String((row.leagues as { name?: string } | null)?.name ?? 'League'),
    season_name: String((row.seasons as { name?: string } | null)?.name ?? 'Season'),
    division_name: (row.divisions as { name?: string } | null)?.name ?? null,
    roster_count: rosterSource.length,
  };
}
