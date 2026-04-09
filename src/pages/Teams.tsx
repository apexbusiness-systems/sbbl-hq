import { useQuery } from '@tanstack/react-query';
import { fetchTeams, type TeamCard } from '@/lib/api/teams';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Users, Trophy, Briefcase, Activity } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { teams as mockTeams, leagues as mockLeagues } from '@/data/mock';

type TabView = 'standings' | 'rosters' | 'stats';

const TeamsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | 'all' | null;
  const { activeLeague, setActiveLeague } = useApp();

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );

  const [activeTab, setActiveTab] = useState<TabView>('standings');

  const handleLeagueFilterChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    if (val !== 'all') setActiveLeague(val);
    setSearchParams({ league: val }, { replace: true });
  };

  useEffect(() => {
    if (isValidParam) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague, isValidParam]);

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => fetchTeams(),
  });

  const filteredTeams = useMemo(() => {
    const apiTeams = teamsQuery.data?.teams;
    let list: TeamCard[] = [];
    
    if (Array.isArray(apiTeams) && apiTeams.length > 0) {
      list = apiTeams;
    } else {
      // Fallback to mock data when API returns empty
      list = mockTeams.map((t): TeamCard => {
        const gp = t.record.wins + t.record.losses;
        return {
          id: t.id,
          name: t.name,
          league_code: t.leagueId.toUpperCase(),
          league_name: mockLeagues.find(l => l.id === t.leagueId)?.name ?? t.leagueId.toUpperCase(),
          season_name: 'Season 11',
          division_name: t.division,
          roster_count: 0,
          players: [],
          coaches: [],
          stats: {
            wins: t.record.wins,
            losses: t.record.losses,
            gamesPlayed: gp,
            ptsFor: 0,
            ptsAgainst: 0,
            winPct: gp > 0 ? (t.record.wins / gp).toFixed(3) : '.000',
            diff: 0,
          },
        };
      });
    }

    if (leagueFilter === 'all') return list;
    const code = getLeagueConfig(leagueFilter).code;
    return list.filter((t) => t.league_code.toLowerCase() === code.toLowerCase());
  }, [teamsQuery.data?.teams, leagueFilter]);

  const standings = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      const winPctA = Number.parseFloat(a.stats.winPct || '0');
      const winPctB = Number.parseFloat(b.stats.winPct || '0');
      if (winPctB !== winPctA) return winPctB - winPctA;
      if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
      return b.stats.diff - a.stats.diff;
    });
  }, [filteredTeams]);

  const statsLeaders = useMemo(() => {
    return [...filteredTeams]
      .filter((t) => t.stats && t.stats.gamesPlayed > 0)
      .sort((a, b) => b.stats.ptsFor - a.stats.ptsFor);
  }, [filteredTeams]);

  // ⚡ Bolt Performance Optimization: Extract expensive filtering and sorting
  // out of the main render loop into useMemo to prevent O(N log N) work on every render.
  const defenseLeaders = useMemo(() => {
    return [...filteredTeams]
      .filter((t) => t.stats && t.stats.gamesPlayed > 0)
      .sort((a, b) => {
        const papgA = a.stats.ptsAgainst / a.stats.gamesPlayed;
        const papgB = b.stats.ptsAgainst / b.stats.gamesPlayed;
        return papgA - papgB;
      });
  }, [filteredTeams]);

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Team&background=random';
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Player&background=random';
  };

  return (
    <div className="container py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Teams & Standings</h1>
        <p className="text-muted-foreground">Rosters, rankings, and team stats.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleLeagueFilterChange('all')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
              leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'
            }`}
          >
            All
          </button>
          {LEAGUE_REGISTRY.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeagueFilterChange(l.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
                leagueFilter === l.id ? 'bg-card text-foreground' : 'text-muted-foreground'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {teamsQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-muted-foreground">Loading teams data...</div>
        </div>
      )}

      {!teamsQuery.isLoading && filteredTeams.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-muted-foreground">No teams found for the selected league.</div>
        </div>
      )}

      {!teamsQuery.isLoading && activeTab === 'standings' && filteredTeams.length > 0 && (
        <div className="space-y-2 max-w-3xl">
          {standings.map((team, index) => {
            const wins = team.stats?.wins ?? 0;
            const losses = team.stats?.losses ?? 0;
            const pct = Number.parseFloat(team.stats?.winPct ?? '0');
            const diff = team.stats?.diff ?? 0;
            const leagueLower = team.league_code.toLowerCase();
            const leagueId: LeagueId = LEAGUE_REGISTRY.some(l => l.id === leagueLower) ? (leagueLower as LeagueId) : 'sbbl';
            return (
              <div key={team.id} className={`panel p-3 flex items-center gap-4 transition-colors hover:border-border/60 ${index < 3 ? 'border-primary/20' : ''}`}>
                <span className="stat-numeral text-sm text-muted-foreground w-6 text-center flex-shrink-0">{index + 1}</span>

                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm truncate">{team.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LeagueBadge leagueId={leagueId} size="sm" />
                    {team.division_name ? (
                      <span className="text-[10px] text-muted-foreground truncate">{team.division_name}</span>
                    ) : team.season_name ? (
                      <span className="text-[10px] text-muted-foreground truncate">{team.season_name}</span>
                    ) : null}
                  </div>
                </div>

                <div className="hidden md:block w-20">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>

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

      {!teamsQuery.isLoading && activeTab === 'rosters' && filteredTeams.length > 0 && (
        <div className="space-y-6">
          {filteredTeams.map((team) => (
            <div key={team.id} className="rounded-lg border border-border/40 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{team.name}</h3>
                  {leagueFilter === 'all' && (
                    <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {team.roster_count} Players
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    {team.coaches?.length || 0} Staff
                  </div>
                </div>
              </div>

              {(team.coaches?.length || 0) > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coaching Staff</h4>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {team.coaches.map((coach) => (
                      <div key={coach.id} className="flex items-center gap-3 p-2 rounded-sm border border-border/30">
                        {coach.avatar_url ? (
                          <img
                            src={coach.avatar_url}
                            alt="avatar"
                            className="w-10 h-10 rounded-full object-cover"
                            onError={handleAvatarError}
                          />
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

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Roster</h4>
                {team.players && team.players.length > 0 ? (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {team.players.map((player) => (
                      <div key={player.id} className="flex items-center gap-3 p-2 rounded-sm border border-border/30">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                          {player.jersey_number != null ? player.jersey_number : '-'}
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
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">No players registered.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!teamsQuery.isLoading && activeTab === 'stats' && filteredTeams.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold mb-4">Highest Scoring Offense (PPG)</h3>
            <div className="space-y-2">
              {statsLeaders.slice(0, 10).map((team, index) => {
                const ppg =
                  team.stats.gamesPlayed > 0 ? (team.stats.ptsFor / team.stats.gamesPlayed).toFixed(1) : '0.0';
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{team.stats.gamesPlayed} GP</div>
                    </div>
                    <div className="text-lg font-bold">{ppg}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Best Defense (PAPG)</h3>
            <div className="space-y-2">
              {defenseLeaders
                .slice(0, 10)
                .map((team, index) => {
                  const papg =
                    team.stats.gamesPlayed > 0 ? (team.stats.ptsAgainst / team.stats.gamesPlayed).toFixed(1) : '0.0';
                  return (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground">{team.stats.gamesPlayed} GP</div>
                      </div>
                      <div className="text-lg font-bold">{papg}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
