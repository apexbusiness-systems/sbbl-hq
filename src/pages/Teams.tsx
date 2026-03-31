import { useQuery } from '@tanstack/react-query';
import { fetchTeams } from '@/lib/api/teams';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { STATIC_TEAMS, getTeamsByLeague } from '@/data/teams';
import { getSchedulesByLeague } from '@/data/schedules';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Users, Calendar, MapPin, Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const TeamsPage = () => {
  const { activeLeague } = useApp();
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: () => fetchTeams() });
  const apiTeams = teamsQuery.data?.teams ?? [];
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>('all');

  // Use API data if available, fall back to static team roster
  const hasApiData = apiTeams.length > 0;

  const staticFiltered = leagueFilter === 'all'
    ? STATIC_TEAMS
    : getTeamsByLeague(leagueFilter);

  const apiFiltered = leagueFilter === 'all'
    ? apiTeams
    : apiTeams.filter((t) => t.league_code === getLeagueConfig(leagueFilter).code);

  const upcomingGames = leagueFilter === 'all'
    ? []
    : getSchedulesByLeague(leagueFilter);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Teams</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hasApiData ? 'Live roster directory' : 'Registered teams across all leagues'}
            </p>
          </div>
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* League filter */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm mb-8 w-fit flex-wrap">
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

        {teamsQuery.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="panel p-4 h-28 animate-pulse bg-secondary" />
            ))}
          </div>
        )}

        {/* API-backed teams */}
        {hasApiData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiFiltered.map((team) => (
              <article key={team.id} className="panel p-4 hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-xl font-bold">{team.name}</h2>
                  <LeagueBadge leagueId={team.league_code?.toLowerCase() as LeagueId} />
                </div>
                <p className="text-xs text-muted-foreground">{team.season_name} &middot; {team.division_name ?? 'Division TBD'}</p>
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary/50" />
                  <span className="text-xs text-muted-foreground">{team.roster_count} rostered players</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Static fallback teams */}
        {!hasApiData && !teamsQuery.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staticFiltered.map((team, i) => {
              const league = getLeagueConfig(team.leagueId);
              return (
                <article key={`${team.leagueId}-${team.name}-${i}`} className="panel p-4 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-display text-xl font-bold">{team.name}</h2>
                    <LeagueBadge leagueId={team.leagueId} />
                  </div>
                  <p className="text-xs text-muted-foreground">{team.season}{team.division ? ` \u00B7 ${team.division}` : ''}</p>
                </article>
              );
            })}
          </div>
        )}

        {/* Upcoming schedule for filtered league */}
        {upcomingGames.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight">Upcoming Schedule</h2>
              <Link to="/schedules" className="text-xs font-semibold uppercase tracking-wider text-primary">
                Full Schedule
              </Link>
            </div>
            {upcomingGames.map((day) => (
              <div key={`${day.leagueId}-${day.date}`} className="panel p-5 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-display text-sm font-bold">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-muted-foreground">{day.season} &middot; Week {day.week}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <MapPin className="w-3 h-3" />
                  <span>{day.venue}, {day.address}</span>
                </div>
                <div className="space-y-1.5">
                  {day.courts.flatMap((c) => c.games).slice(0, 5).map((game, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="text-xs text-muted-foreground tabular-nums w-20 flex-shrink-0">{game.time}</span>
                      <span className="font-medium truncate">{game.home}</span>
                      <span className="text-[10px] text-primary font-bold flex-shrink-0">VS</span>
                      <span className="font-medium truncate">{game.away}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{game.court}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;
