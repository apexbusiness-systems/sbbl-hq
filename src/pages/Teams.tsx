import { useQuery } from '@tanstack/react-query';
import { fetchTeams, type TeamCard } from '@/lib/api/teams';
import { STATIC_TEAMS, type StaticTeam } from '@/data/teams';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Users, Trophy, Target, Activity, UserCircle, Briefcase, Shield } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type TabView = 'overview' | 'standings' | 'rosters' | 'stats';

/**
 * Convert a parsed StaticTeam (from official league schedule graphics) into the
 * TeamCard shape used by the Teams page views. This uses REAL team data — not mock.
 */
function staticTeamToTeamCard(team: StaticTeam, index: number): TeamCard {
  const leagueEntry = LEAGUE_REGISTRY.find(l => l.id === team.leagueId);

  return {
    id: `static-${team.leagueCode}-${index}`,
    name: team.name,
    league_code: team.leagueCode,
    league_name: leagueEntry?.name ?? team.leagueCode,
    season_name: team.season,
    division_name: team.season,
    roster_count: 0,
    players: [],
    coaches: [],
    stats: {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      ptsFor: 0,
      ptsAgainst: 0,
      winPct: '.000',
      diff: 0,
    },
  };
}

const TeamsPage = () => {
  const [searchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | null;
  const { activeLeague } = useApp();

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(paramLeague && LEAGUE_REGISTRY.some(l => l.id === paramLeague) ? paramLeague : (activeLeague || 'all'));
  const [activeTab, setActiveTab] = useState<TabView>('overview');

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: () => fetchTeams(), retry: 1, staleTime: 120_000 });

  // Use API data if available, fall back to STATIC_TEAMS (real parsed data)
  const allTeams = useMemo<TeamCard[]>(() => {
    const apiTeams = teamsQuery.data?.teams;
    if (Array.isArray(apiTeams) && apiTeams.length > 0) return apiTeams;
    return STATIC_TEAMS.map((t, i) => staticTeamToTeamCard(t, i));
  }, [teamsQuery.data?.teams]);

  const filteredTeams = useMemo(() => {
    if (leagueFilter === 'all') return allTeams;
    const entry = LEAGUE_REGISTRY.find(l => l.id === leagueFilter);
    const code = entry?.code ?? leagueFilter.toUpperCase();
    return allTeams.filter(t => t.league_code === code);
  }, [allTeams, leagueFilter]);

  const standings = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      const winPctA = Number.parseFloat(a.stats?.winPct || '0');
      const winPctB = Number.parseFloat(b.stats?.winPct || '0');
      if (winPctB !== winPctA) return winPctB - winPctA;
      if (b.stats?.wins !== a.stats?.wins) return (b.stats?.wins || 0) - (a.stats?.wins || 0);
      return (b.stats?.diff || 0) - (a.stats?.diff || 0);
    });
  }, [filteredTeams]);

  const statsLeaders = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      return (b.stats?.ptsFor || 0) - (a.stats?.ptsFor || 0);
    });
  }, [filteredTeams]);

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Player&background=random';
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Teams & Standings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rosters, rankings, and team stats.
            </p>
          </div>
          <Trophy className="w-6 h-6 text-primary" />
        </div>

        {/* Filters and Tabs Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          {/* League filter */}
          <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit flex-wrap">
            <button
              onClick={() => setLeagueFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              All
            </button>
            {LEAGUE_REGISTRY.map((l) => (
              <button
                key={l.id}
                onClick={() => setLeagueFilter(l.id)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === l.id ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              >
                {l.shortName}
              </button>
            ))}
          </div>

          {/* View Tabs */}
          <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Users },
              { id: 'standings', label: 'Standings', icon: Trophy },
              { id: 'rosters', label: 'Rosters', icon: Users },
              { id: 'stats', label: 'Stats', icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabView)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${activeTab === tab.id ? 'bg-card text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {teamsQuery.isLoading && (
          <div className="panel p-4 h-64 animate-pulse bg-secondary" />
        )}

        {!teamsQuery.isLoading && filteredTeams.length === 0 && (
          <div className="panel p-8 text-center border-dashed">
            <p className="text-muted-foreground text-sm">No teams found for the selected league.</p>
          </div>
        )}

        {/* ── OVERVIEW VIEW (Team Cards — ported from Profiles) ─────── */}
        {!teamsQuery.isLoading && activeTab === 'overview' && filteredTeams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeams.map(t => (
              <div key={t.id} className="panel p-4 hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.division_name || t.season_name}</p>
                  </div>
                  <LeagueBadge leagueId={t.league_code.toLowerCase() as LeagueId} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-success">{t.stats?.wins || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl text-destructive">{t.stats?.losses || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Losses</p>
                  </div>
                  <div className="text-center">
                    <p className="stat-numeral text-2xl">
                      {t.stats && t.stats.gamesPlayed > 0
                        ? `${((t.stats.wins / t.stats.gamesPlayed) * 100).toFixed(0)}%`
                        : '0%'}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Win %</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Roster: {t.players && t.players.length > 0
                      ? t.players.map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean).join(', ')
                      : 'View full roster'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STANDINGS VIEW ────────────────────────────────────────── */}
        {!teamsQuery.isLoading && activeTab === 'standings' && filteredTeams.length > 0 && (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] w-12 text-center">Rank</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Team</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">W</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">L</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">PCT</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">PF</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">PA</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-muted-foreground text-[10px] text-center">DIFF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {standings.map((team, index) => (
                    <tr key={team.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-center font-bold text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-bold text-foreground font-display">{team.name}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              {leagueFilter === 'all' && <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} />}
                              {team.season_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{team.stats?.wins || 0}</td>
                      <td className="px-4 py-3 text-center font-semibold">{team.stats?.losses || 0}</td>
                      <td className="px-4 py-3 text-center font-bold text-primary">{team.stats?.winPct || '.000'}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{team.stats?.ptsFor || 0}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{team.stats?.ptsAgainst || 0}</td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {(() => {
                          const diff = team.stats?.diff ?? 0;
                          const diffClass = diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground';
                          return (
                            <span className={diffClass}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ROSTERS VIEW ────────────────────────────────────────── */}
        {!teamsQuery.isLoading && activeTab === 'rosters' && filteredTeams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <div key={team.id} className="panel overflow-hidden flex flex-col hover:border-primary/20 transition-colors">
                <div className="p-5 border-b border-border bg-secondary/20">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-display text-xl font-bold tracking-tight">{team.name}</h3>
                    {leagueFilter === 'all' && <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} />}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {team.roster_count} Players</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {team.coaches?.length || 0} Staff</span>
                  </div>
                </div>

                <div className="p-0 flex-grow">
                  {/* Coaches Section */}
                  {(team.coaches?.length || 0) > 0 && (
                    <div className="px-5 py-3 border-b border-border/50 bg-secondary/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Coaching Staff</p>
                      <div className="space-y-2">
                        {team.coaches.map(coach => (
                          <div key={coach.id} className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-secondary border border-border flex-shrink-0">
                              {coach.avatar_url ? (
                                <img src={coach.avatar_url} alt="avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
                              ) : (
                                <UserCircle className="w-full h-full text-muted-foreground/50 p-0.5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                              <p className="text-xs font-medium truncate">
                                {coach.first_name || coach.last_name ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim() : 'Coach'}
                              </p>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded-sm border border-border/50 bg-background/50">
                                {coach.role === 'team_manager' ? 'Manager' : coach.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Players Section */}
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Active Roster</p>
                    {(!team.players || team.players.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic">No players registered.</p>
                    ) : (
                      <div className="space-y-2">
                        {team.players.map(player => (
                          <div key={player.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-sm bg-secondary border border-border flex items-center justify-center font-display font-bold text-sm text-muted-foreground flex-shrink-0">
                              {player.jersey_number ?? '-'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate text-foreground leading-tight">
                                {player.first_name || player.last_name ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : 'Player'}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                {player.position || 'N/A'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STATS VIEW ────────────────────────────────────────── */}
        {!teamsQuery.isLoading && activeTab === 'stats' && filteredTeams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="panel p-5">
              <h3 className="font-display text-lg font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Highest Scoring Offense (PPG)
              </h3>
              <div className="space-y-3">
                {statsLeaders.slice(0, 10).map((team, index) => {
                  const ppg = team.stats.gamesPlayed > 0 ? (team.stats.ptsFor / team.stats.gamesPlayed).toFixed(1) : '0.0';
                  return (
                    <div key={team.id} className="flex items-center justify-between p-2 rounded-sm hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-muted-foreground text-sm w-4">{index + 1}</span>
                        <div>
                          <p className="font-bold text-sm">{team.name}</p>
                          <p className="text-[10px] text-muted-foreground">{team.stats.gamesPlayed} GP</p>
                        </div>
                      </div>
                      <span className="font-display font-bold text-primary">{ppg}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="font-display text-lg font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Best Defense (PAPG)
              </h3>
              <div className="space-y-3">
                {[...filteredTeams]
                  .filter(t => t.stats.gamesPlayed > 0)
                  .sort((a, b) => {
                    const papgA = a.stats.ptsAgainst / a.stats.gamesPlayed;
                    const papgB = b.stats.ptsAgainst / b.stats.gamesPlayed;
                    return papgA - papgB;
                  })
                  .slice(0, 10)
                  .map((team, index) => {
                  const papg = team.stats.gamesPlayed > 0 ? (team.stats.ptsAgainst / team.stats.gamesPlayed).toFixed(1) : '0.0';
                  return (
                    <div key={team.id} className="flex items-center justify-between p-2 rounded-sm hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-muted-foreground text-sm w-4">{index + 1}</span>
                        <div>
                          <p className="font-bold text-sm">{team.name}</p>
                          <p className="text-[10px] text-muted-foreground">{team.stats.gamesPlayed} GP</p>
                        </div>
                      </div>
                      <span className="font-display font-bold text-foreground">{papg}</span>
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
