import { useQuery } from '@tanstack/react-query';
import { fetchTeams, type TeamCard, type PlayerProfile, type CoachProfile } from '@/lib/api/teams';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig, leagueCodeFromId } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Users, Calendar, MapPin, Trophy, Target, TargetIcon, Navigation, UserCircle, Briefcase, Activity, Shield } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type TabView = 'standings' | 'rosters' | 'stats';

const TeamsPage = () => {
  const [searchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | null;
  const { activeLeague } = useApp();

  // League filter state: initialize from URL param or activeLeague.
  // Always default to 'all' if neither is provided.
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    paramLeague && LEAGUE_REGISTRY.some((l) => l.id === paramLeague)
      ? paramLeague
      : (activeLeague || 'all')
  );

  const [activeTab, setActiveTab] = useState<TabView>('standings');

  // CRITICAL FIX: sync leagueFilter with external activeLeague changes from header navigation
  useEffect(() => {
    // If user switches league via header or direct navigation, sync the filter.
    // URL param takes precedence, then activeLeague from context.
    if (paramLeague && LEAGUE_REGISTRY.some((l) => l.id === paramLeague)) {
      setLeagueFilter(paramLeague);
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague]);

  // Fetch ALL teams once from the worker — the queryKey is static ['teams'] so
  // switching filters doesn't cause a refetch; we simply re-filter client-side.
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => fetchTeams(),
  });

  const filteredTeams = useMemo(() => {
    const apiTeams = teamsQuery.data?.teams ?? [];
    if (leagueFilter === 'all') return apiTeams;
    const code = getLeagueConfig(leagueFilter).code;
    return apiTeams.filter((t) => t.league_code === code);
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
      .filter((t) => t.stats.gamesPlayed > 0) // Only include teams with games played
      .sort((a, b) => b.stats.ptsFor - a.stats.ptsFor);
  }, [filteredTeams]);

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Team&background=random';
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Player&background=random';
  };

  return (
    <div className=\"container py-8 max-w-7xl\">
      {/* Page Header */}
      <div className=\"mb-8\">
        <h1 className=\"text-3xl font-bold mb-1\">Teams & Standings</h1>
        <p className=\"text-muted-foreground\">Rosters, rankings, and team stats.</p>
      </div>

      {/* Filters and Tabs Row */}
      <div className=\"flex flex-col md:flex-row gap-4 mb-6\">
        {/* League filter */}
        <div className=\"flex items-center gap-2 flex-wrap\">
          <button
            onClick={() => setLeagueFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
              leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'
            }`}
          >
            All
          </button>
          {LEAGUE_REGISTRY.map((l) => (
            <button
              key={l.id}
              onClick={() => setLeagueFilter(l.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${
                leagueFilter === l.id ? 'bg-card text-foreground' : 'text-muted-foreground'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div className=\"flex items-center gap-2 flex-wrap ml-auto\">
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
                <Icon className=\"w-4 h-4\" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {teamsQuery.isLoading && (
        <div className=\"flex items-center justify-center py-16\">
          <div className=\"text-muted-foreground\">Loading teams data...</div>
        </div>
      )}

      {/* Empty state */}
      {!teamsQuery.isLoading && filteredTeams.length === 0 && (
        <div className=\"flex items-center justify-center py-16\">
          <div className=\"text-muted-foreground\">No teams found for the selected league.</div>
        </div>
      )}

      {/* ── STANDINGS VIEW ────────────────────────────────────────── */}
      {!teamsQuery.isLoading && activeTab === 'standings' && filteredTeams.length > 0 && (
        <div className=\"overflow-x-auto rounded-lg border border-border/40\">
          <table className=\"w-full text-sm\">
            <thead className=\"bg-muted/40 text-muted-foreground font-medium\">
              <tr>
                <th className=\"px-4 py-2 text-left\">Rank</th>
                <th className=\"px-4 py-2 text-left\">Team</th>
                <th className=\"px-2 py-2 text-center\">W</th>
                <th className=\"px-2 py-2 text-center\">L</th>
                <th className=\"px-2 py-2 text-center\">PCT</th>
                <th className=\"px-2 py-2 text-center\">PF</th>
                <th className=\"px-2 py-2 text-center\">PA</th>
                <th className=\"px-2 py-2 text-center\">DIFF</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr key={team.id} className=\"border-t border-border/30 hover:bg-muted/20 transition-colors\">
                  <td className=\"px-4 py-3 text-muted-foreground font-medium\">{index + 1}</td>
                  <td className=\"px-4 py-3\">
                    <div className=\"flex items-center gap-2\">
                      <div className=\"font-semibold\">{team.name}</div>
                      {leagueFilter === 'all' && (
                        <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} size=\"sm\" variant=\"subtle\" />
                      )}
                    </div>
                    <div className=\"text-xs text-muted-foreground mt-0.5\">{team.season_name}</div>
                  </td>
                  <td className=\"px-2 py-3 text-center font-semibold\">{team.stats.wins}</td>
                  <td className=\"px-2 py-3 text-center font-semibold\">{team.stats.losses}</td>
                  <td className=\"px-2 py-3 text-center font-mono\">{team.stats.winPct}</td>
                  <td className=\"px-2 py-3 text-center\">{team.stats.ptsFor}</td>
                  <td className=\"px-2 py-3 text-center\">{team.stats.ptsAgainst}</td>
                  <td
                    className={`px-2 py-3 text-center font-semibold ${
                      team.stats.diff > 0
                        ? 'text-green-500'
                        : team.stats.diff < 0
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {team.stats.diff > 0 ? '+' : ''}{team.stats.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ROSTERS VIEW ────────────────────────────────────────── */}
      {!teamsQuery.isLoading && activeTab === 'rosters' && filteredTeams.length > 0 && (
        <div className=\"space-y-6\">
          {filteredTeams.map((team) => (
            <div key={team.id} className=\"rounded-lg border border-border/40 bg-card p-6\">
              <div className=\"flex items-center justify-between mb-4\">
                <div>
                  <h3 className=\"text-lg font-semibold\">{team.name}</h3>
                  {leagueFilter === 'all' && (
                    <LeagueBadge leagueId={team.league_code.toLowerCase() as LeagueId} size=\"sm\" variant=\"subtle\" />
                  )}
                </div>
                <div className=\"flex items-center gap-4 text-xs text-muted-foreground\">
                  <div className=\"flex items-center gap-1.5\">
                    <Users className=\"w-4 h-4\" />
                    {team.roster_count} Players
                  </div>
                  <div className=\"flex items-center gap-1.5\">
                    <Briefcase className=\"w-4 h-4\" />
                    {team.coaches?.length || 0} Staff
                  </div>
                </div>
              </div>

              {/* Coaches Section */}
              {(team.coaches?.length || 0) > 0 && (
                <div className=\"mb-6\">
                  <h4 className=\"text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3\">Coaching Staff</h4>
                  <div className=\"grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3\">
                    {team.coaches.map((coach) => (
                      <div key={coach.id} className=\"flex items-center gap-3 p-2 rounded-sm border border-border/30\">
                        {coach.avatar_url ? (
                          <img
                            src={coach.avatar_url}
                            alt=\"avatar\"
                            className=\"w-10 h-10 rounded-full object-cover\"
                            onError={handleAvatarError}
                          />
                        ) : (
                          <div className=\"w-10 h-10 rounded-full bg-muted flex items-center justify-center\">
                            <Briefcase className=\"w-5 h-5 text-muted-foreground\" />
                          </div>
                        )}
                        <div className=\"flex-1 min-w-0\">
                          <div className=\"text-sm font-medium truncate\">
                            {coach.first_name || coach.last_name
                              ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim()
                              : 'Coach'}
                          </div>
                          <div className=\"text-xs text-muted-foreground\">
                            {coach.role === 'team_manager' ? 'Manager' : coach.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Players Section */}
              <div>
                <h4 className=\"text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3\">Active Roster</h4>
                {(!team.players || team.players.length === 0) ? (
                  <div className=\"text-sm text-muted-foreground py-4 text-center\">No players registered.</div>
                ) : (
                  <div className=\"grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3\">
                    {team.players.map((player) => (
                      <div key={player.id} className=\"flex items-center gap-3 p-2 rounded-sm border border-border/30\">
                        <div className=\"flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm\">
                          {player.jersey_number != null ? player.jersey_number : '-'}
                        </div>
                        <div className=\"flex-1 min-w-0\">
                          <div className=\"text-sm font-medium truncate\">
                            {player.first_name || player.last_name
                              ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
                              : 'Player'}
                          </div>
                          <div className=\"text-xs text-muted-foreground\">{player.position || 'N/A'}</div>
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

      {/* ── STATS VIEW ────────────────────────────────────────── */}
      {!teamsQuery.isLoading && activeTab === 'stats' && filteredTeams.length > 0 && (
        <div className=\"grid gap-6 lg:grid-cols-2\">
          <div>
            <h3 className=\"text-lg font-semibold mb-4\">Highest Scoring Offense (PPG)</h3>
            <div className=\"space-y-2\">
              {statsLeaders.slice(0, 10).map((team, index) => {
                const ppg =
                  team.stats.gamesPlayed > 0 ? (team.stats.ptsFor / team.stats.gamesPlayed).toFixed(1) : '0.0';
                return (
                  <div
                    key={team.id}
                    className=\"flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors\"
                  >
                    <div className=\"flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm\">
                      {index + 1}
                    </div>
                    <div className=\"flex-1 min-w-0\">
                      <div className=\"font-semibold truncate\">{team.name}</div>
                      <div className=\"text-xs text-muted-foreground\">{team.stats.gamesPlayed} GP</div>
                    </div>
                    <div className=\"text-lg font-bold\">{ppg}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className=\"text-lg font-semibold mb-4\">Best Defense (PAPG)</h3>
            <div className=\"space-y-2\">
              {[...filteredTeams]
                .filter((t) => t.stats.gamesPlayed > 0)
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
                      className=\"flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors\"
                    >
                      <div className=\"flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm\">
                        {index + 1}
                      </div>
                      <div className=\"flex-1 min-w-0\">
                        <div className=\"font-semibold truncate\">{team.name}</div>
                        <div className=\"text-xs text-muted-foreground\">{team.stats.gamesPlayed} GP</div>
                      </div>
                      <div className=\"text-lg font-bold\">{papg}</div>
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
