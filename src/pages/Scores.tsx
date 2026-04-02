import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { SCHEDULE_DATA, type ScheduleDay } from '@/data/schedules';
import { games as parsedGames } from '@/data/mock';
import type { LeagueId } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, Flame, Clock, CheckCircle } from 'lucide-react';

const ScoresPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | 'all' | null;
  const { activeLeague, setActiveLeague } = useApp();

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );

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

  // Merge parsed game scores (from data/mock.ts games array) with schedule data
  const filteredGames = useMemo(() => {
    const allGames = parsedGames.filter(g => {
      if (leagueFilter === 'all') return true;
      return g.leagueId === leagueFilter;
    });
    return allGames.sort((a, b) => {
      // Live first, then final, then upcoming
      const order = { live: 0, final: 1, upcoming: 2, postponed: 3, review_pending: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });
  }, [leagueFilter]);

  // Get upcoming matchups from parsed schedule data
  const upcomingSchedules = useMemo<ScheduleDay[]>(() => {
    if (leagueFilter === 'all') return SCHEDULE_DATA;
    return SCHEDULE_DATA.filter(s => s.leagueId === leagueFilter);
  }, [leagueFilter]);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Scores</h1>
            <p className="text-sm text-muted-foreground mt-1">Live, final, and upcoming game scores</p>
          </div>
          <Trophy className="w-6 h-6 text-primary" />
        </div>

        {/* League filter */}
        <div className="flex bg-secondary p-1 rounded-sm w-fit mb-8 flex-wrap">
          {[{ id: 'all', name: 'All Leagues' }, ...LEAGUE_REGISTRY].map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeagueFilterChange(l.id as LeagueId | 'all')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                leagueFilter === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {'shortName' in l ? l.shortName : l.name}
            </button>
          ))}
        </div>

        {/* Game Score Cards */}
        {filteredGames.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" /> Game Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map((g) => (
                <div key={g.id} className={`panel p-4 flex flex-col justify-between min-h-[140px] ${g.status === 'live' ? 'border-primary/50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-sm ${
                      g.status === 'live'
                        ? 'bg-red-500/10 text-red-500'
                        : g.status === 'final'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-secondary text-muted-foreground'
                    }`}>
                      {g.status === 'live' && <Flame className="w-3 h-3" />}
                      {g.status === 'final' && <CheckCircle className="w-3 h-3" />}
                      {g.status === 'upcoming' && <Clock className="w-3 h-3" />}
                      {g.status}
                    </span>
                    <LeagueBadge leagueId={g.leagueId} size="sm" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm truncate pr-2">{g.awayTeam.name}</span>
                      <span className={`stat-numeral text-xl ${g.status === 'upcoming' ? 'text-muted-foreground opacity-50' : g.score && g.score.away > (g.score.home ?? 0) ? 'text-primary' : ''}`}>
                        {g.score?.away ?? '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm truncate pr-2">{g.homeTeam.name}</span>
                      <span className={`stat-numeral text-xl ${g.status === 'upcoming' ? 'text-muted-foreground opacity-50' : g.score && g.score.home > (g.score.away ?? 0) ? 'text-primary' : ''}`}>
                        {g.score?.home ?? '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
                    <span>{g.venue} · {g.court}</span>
                    <span>{g.date} · {g.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Schedule Matchups (from parsed schedule data) */}
        {upcomingSchedules.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-tight mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Upcoming Matchups
            </h2>
            <div className="space-y-4">
              {upcomingSchedules.map((day) => (
                <div key={`${day.leagueId}-${day.date}`} className="panel overflow-hidden">
                  <div className="px-5 py-3 bg-secondary/30 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-sm">{day.venue}</p>
                      <p className="text-[10px] text-muted-foreground">{day.address} · {day.date} · Week {day.week}</p>
                    </div>
                    <LeagueBadge leagueId={day.leagueId} size="sm" />
                  </div>
                  <div className="divide-y divide-border">
                    {day.courts.map((court) =>
                      court.games.map((game, i) => (
                        <div key={`${court.name}-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="text-[10px] text-muted-foreground font-mono w-16 flex-shrink-0">{game.time}</span>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-display font-bold text-sm">{game.home}</span>
                              <span className="text-[10px] text-muted-foreground">vs</span>
                              <span className="font-display font-bold text-sm">{game.away}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase">{court.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredGames.length === 0 && upcomingSchedules.length === 0 && (
          <div className="panel p-12 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold">No scores available</p>
            <p className="text-sm text-muted-foreground">
              Check back later for {leagueFilter === 'all' ? 'league' : getLeagueConfig(leagueFilter as LeagueId)?.name} results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoresPage;
