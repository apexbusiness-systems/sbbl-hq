import { useQuery } from '@tanstack/react-query';
import { fetchTeams } from '@/lib/api/teams';

const TeamsPage = () => {
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: () => fetchTeams() });
  const teams = teamsQuery.data?.teams ?? [];

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl">Teams</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Live roster directory</p>
      </div>
      {teamsQuery.isLoading && <div className="panel p-4 text-sm text-muted-foreground">Loading teams…</div>}
      {teamsQuery.isError && <div className="panel p-4 text-sm text-destructive">Failed to load teams. {(teamsQuery.error as Error).message}</div>}
      {!teamsQuery.isLoading && teams.length === 0 && (
        <div className="panel p-8 text-sm text-muted-foreground">No teams published yet for active seasons.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <article key={team.id} className="panel p-4">
            <h2 className="font-display text-2xl text-primary">{team.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">{team.league_name} · {team.season_name}</p>
            <p className="text-xs text-muted-foreground">{team.division_name ?? 'Division TBD'}</p>
            <div className="mt-3 text-sm">Roster count: <span className="stat-numeral">{team.roster_count}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default TeamsPage;
