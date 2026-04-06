import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useQuery } from '@tanstack/react-query';
import { fetchTeams } from '@/lib/api/teams';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Users, Trophy, Briefcase, Activity } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type TabView = 'standings' | 'rosters' | 'stats';

const TeamsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | 'all' | null;
  const { activeLeague, setActiveLeague } = useApp();

  // Validate paramLeague: must be 'all' or in LEAGUE_REGISTRY
  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));

  // League filter state: initialize from URL param or activeLeague.
  // Always default to 'all' if neither is provided.
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );

  const [activeTab, setActiveTab] = useState<TabView>('standings');

  // Keep URL and local state in sync when user clicks page filters
  const handleLeagueFilterChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    if (val !== 'all') setActiveLeague(val);
    setSearchParams({ league: val }, { replace: true });
  };

  // CRITICAL FIX: sync leagueFilter with external activeLeague changes from header navigation
  useEffect(() => {
    // If user switches league via header or direct navigation, sync the filter.
    // URL param takes precedence, then activeLeague from context.
    if (isValidParam) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague, isValidParam]);

  // Fetch ALL teams once from the worker  --the queryKey is static ['teams'] so
  // switching filters doesn't cause a refetch; we simply re-filter client-side.
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => fetchTeams(),
  });

  const filteredTeams = useMemo(() => {
    const apiTeams = teamsQuery.data?.teams ?? [];
    if (leagueFilter === 'all') return apiTeams;
    // FIX: Case-insensitive comparison for league_code.
    // ROOT CAUSE: Worker normalises league_code to uppercase via .toUpperCase(), and
    // getLeagueConfig().code is also uppercase (e.g. 'WBL'). However if the DB ever
    // returns mixed-case codes (migration not yet applied, or legacy data), a strict
    // === comparison silently returns 0 teams — no error thrown, just an empty view.
    // CHANGE: normalise both sides to uppercase before comparing.
    const code = getLeagueConfig(leagueFilter).code.toUpperCase();
    return apiTeams.filter((t) => t.league_code.toUpperCase() === code);
  }, [teamsQuery.data?.teams, leagueFilter]);

  // Standings: sort by Win PCT descending, then wins descending, then diff descending
  const standings = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      const winPctA = parseFloat(a.stats.winPct || '0');
      const winPctB = parseFloat(b.stats.winPct || '0');
      if (winPctB !== winPctA) return winPctB - winPctA;
      if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
      return b.stats.diff - a.stats.diff;
    });
  }, [filteredTeams]);

  // Stats leaders: sort by Points For (total offense)
  const statsLeaders = useMemo(() => {
    return [...filteredTeams]
      .filter((t) => t.stats && t.stats.gamesPlayed > 0) // Only include teams with games played
      .sort((a, b) => b.stats.ptsFor - a.stats.ptsFor);
  }, [filteredTeams]);

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Team&background=random';
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Player&background=random';
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Teams & Standings</h1>
          <p className="text-sm text-muted-foreground mt-1">Rosters, rankings, and team stats.</p>
        </div>
        <Trophy className="w-5 h-5 text-primary" />
      </div>

      {/* Filters and Tabs Row */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* League filter */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit">
          <button
            onClick={() => handleLeagueFilterChange('all')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
              leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {LEAGUE_REGISTRY.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeagueFilterChange(l.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
                leagueFilter === l.id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 ml-auto overflow-x-auto scrollbar-hidden">
          {[
            { id: 'standings', label: 'Standings', icon: Trophy },
            { id: 'rosters', label: 'Rosters', icon: Users },
            { id: 'stats', label: 'Stats', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabView)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {teamsQuery.isLoading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading teams data...</p>
        </div>
      )}

      {/* Error state */}
      {!teamsQuery.isLoading && teamsQuery.isError && (
        <div className="panel p-12 text-center">
          <Trophy className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">Failed to load teams</p>
          <p className="text-sm text-muted-foreground mb-4">
            {teamsQuery.error instanceof Error ? teamsQuery.error.message : 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => teamsQuery.refetch()}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!teamsQuery.isLoading && !teamsQuery.isError && filteredTeams.length === 0 && (
        <div className="panel p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">No teams found</p>
          <p className="text-sm text-muted-foreground">No teams found for the selected league.</p>
        </div>
      )}

      {/* -- STANDINGS VIEW ------------------------------------------ */}
      {!teamsQuery.isLoading && activeTab === 'standings' && filteredTeams.length > 0 && (
        <div className="space-y-2 max-w-3xl">
          {standings.map((team, index) => {
            const wins = team.stats?.wins ?? 0;
            const losses = team.stats?.losses ?? 0;
            const pct = parseFloat(team.stats?.winPct ?? '0');
            const diff = team.stats?.diff ?? 0;
            const leagueId = team.league_code.toLowerCase() as LeagueId;
            return (
              <div key={team.id} className={`panel p-3 flex items-center gap-4 transition-colors hover:border-border/60 ${index < 3 ? 'border-primary/20' : ''}`}>
                {/* Rank */}
                <span className="stat-numeral text-sm text-muted-foreground w-6 text-center flex-shrink-0">{index + 1}</span>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm truncate">{team.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LeagueBadge leagueId={leagueId} size="sm" />
                    {team.division_name && (
                      <span className="text-[10px] text-muted-foreground truncate">{team.division_name}</span>
                    )}
                    {!team.division_name && team.season_name && (
                      <span className="text-[10px] text-muted-foreground truncate">{team.season_name}</span>
                    )}
                  </div>
                </div>

                {/* Win% bar — desktop only */}
                <div className="hidden md:block w-20">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <span className="stat-numeral text-sm text-success">{wins}W</span>
                  <span className="stat-numeral text-sm text-destructive">{losses}L</span>
                  <span className={`stat-numeral text-sm font-bold w-10 text-right ${diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {(pct * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- ROSTERS VIEW ------------------------------------------ */}
      {!teamsQuery.isLoading && activeTab === 'rosters' && filteredTeams.length > 0 && (
        <div className="space-y-6">
          {filteredTeams.map((team) => (
            <div key={team.id} className="panel overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{team.name}</h3>
                  {leagueFilter === 'all' && (
                    <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span className="stat-numeral text-sm">{team.roster_count}</span> Players
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    <span className="stat-numeral text-sm">{team.coaches?.length || 0}</span> Staff
                  </div>
                </div>
              </div>

              {/* Coaches Section */}
              {(team.coaches?.length || 0) > 0 && (
                <div className="px-5 py-4 border-b border-border">
                  <h4 className="font-display text-sm font-bold uppercase tracking-wider text-primary mb-3">Coaching Staff</h4>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {team.coaches.map((coach) => (
                      <div key={coach.id} className="flex items-center gap-3 p-2 rounded-sm border border-border/30">
                        {coach.avatar_url ? (
                          <PlayerAvatar src={coach.avatar_url} alt="avatar" className="w-10 h-10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {coach.first_name || coach.last_name
                              ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim()
                              : 'Coach'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {coach.role === 'team_manager' ? 'Manager' : coach.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Players Section */}
              <div className="px-5 py-4">
                <h4 className="font-display text-sm font-bold uppercase tracking-wider text-primary mb-3">Active Roster</h4>
                {(!team.players || team.players.length === 0) ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">No players registered.</div>
                ) : (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {team.players.map((player) => (
                      <div key={player.id} className="flex items-center gap-3 p-2 rounded-sm border border-border/30">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="stat-numeral text-sm">{player.jersey_number != null ? player.jersey_number : '-'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {player.first_name || player.last_name
                              ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
                              : 'Player'}
                          </div>
                          <div className="text-xs text-muted-foreground">{player.position || 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- STATS VIEW ------------------------------------------ */}
      {!teamsQuery.isLoading && activeTab === 'stats' && filteredTeams.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-lg font-bold mb-4">Highest Scoring Offense (PPG)</h3>
            <div className="space-y-2">
              {statsLeaders.slice(0, 10).map((team, index) => {
                const ppg =
                  team.stats.gamesPlayed > 0 ? (team.stats.ptsFor / team.stats.gamesPlayed).toFixed(1) : '0.0';
                return (
                  <div
                    key={team.id}
                    className="panel p-3 flex items-center gap-3 hover:border-border/60 transition-colors"
                  >
                    <span className="stat-numeral text-sm text-muted-foreground w-6 text-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm truncate">{team.name}</div>
                      <div className="text-[10px] text-muted-foreground">{team.stats.gamesPlayed} GP</div>
                    </div>
                    <span className="stat-numeral text-xl text-primary">{ppg}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold mb-4">Best Defense (PAPG)</h3>
            <div className="space-y-2">
              {[...filteredTeams]
                .filter((t) => t.stats && t.stats.gamesPlayed > 0)
                .sort((a, b) => {
                  const papgA = a.stats.ptsAgainst / a.stats.gamesPlayed;
                  const papgB = b.stats.ptsAgainst / b.stats.gamesPlayed;
                  return papgA - papgB; // Lower is better
                })
                .slice(0, 10)
                .map((team, index) => {
                  const papg =
                    team.stats.gamesPlayed > 0 ? (team.stats.ptsAgainst / team.stats.gamesPlayed).toFixed(1) : '0.0';
                  return (
                    <div
                      key={team.id}
                      className="panel p-3 flex items-center gap-3 hover:border-border/60 transition-colors"
                    >
                      <span className="stat-numeral text-sm text-muted-foreground w-6 text-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-sm truncate">{team.name}</div>
                        <div className="text-[10px] text-muted-foreground">{team.stats.gamesPlayed} GP</div>
                      </div>
                      <span className="stat-numeral text-xl text-primary">{papg}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default TeamsPage;
