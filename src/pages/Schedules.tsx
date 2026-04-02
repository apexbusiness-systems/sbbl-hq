import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { SCHEDULE_DATA, type ScheduleDay } from '@/data/schedules';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicSchedule } from '@/lib/api/public';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const SchedulesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | 'all' | null;
  const { activeLeague, setActiveLeague } = useApp();

  // Validate paramLeague: must be 'all' or in LEAGUE_REGISTRY
  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));

  // League filter state: initialize from URL param or activeLeague.
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );
  const { data: liveDataRes, isLoading } = useQuery({
    queryKey: ['public-schedule', leagueFilter],
    queryFn: () => fetchPublicSchedule(leagueFilter),
    staleTime: 1000 * 60 * 5,
  });
  const liveSchedules = liveDataRes?.data || [];

  // Keep URL and local state in sync when user clicks page filters
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

  const filtered = leagueFilter === 'all'
    ? SCHEDULE_DATA
    : SCHEDULE_DATA.filter((s) => s.leagueId === leagueFilter);

  // Safely map live schedules into ScheduleDay shape if we have them
  // Group by league and date, then court
  const groupedLive = liveSchedules.reduce((acc: any, curr: any) => {
    const key = `${curr.league_id}-${curr.start_time.split('T')[0]}`;
    if (!acc[key]) {
      acc[key] = {
        leagueId: curr.league_id,
        season: 'Current Season',
        week: '1',
        date: curr.start_time.split('T')[0],
        venue: curr.venue || 'TBA',
        address: curr.address || 'TBA',
        courts: {}
      };
    }
    const courtName = curr.court || 'Main Court';
    if (!acc[key].courts[courtName]) {
      acc[key].courts[courtName] = [];
    }
    const time = new Date(curr.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    acc[key].courts[courtName].push({
      time,
      home: curr.home_team_id || 'TBA',
      away: curr.away_team_id || 'TBA'
    });
    return acc;
  }, {});

  const mappedLiveSchedules: ScheduleDay[] = Object.values(groupedLive).map((g: any) => ({
    ...g,
    courts: Object.entries(g.courts).map(([name, games]) => ({ name, games: games as any[] }))
  }));

  const displayData = mappedLiveSchedules.length > 0 ? mappedLiveSchedules : filtered;


  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Schedules</h1>
            <p className="text-sm text-muted-foreground mt-1">Game schedules across all leagues</p>
          </div>
          <Calendar className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* League filter */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm mb-8 w-fit">
          <button
            onClick={() => handleLeagueFilterChange('all')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
          >
            All
          </button>
          {LEAGUE_REGISTRY.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeagueFilterChange(l.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === l.id ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              {l.shortName}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="panel p-8 text-center">
            <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold">No Schedules Yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Game schedules will appear here as leagues publish their fixtures.
            </p>
          </div>
        )}

        {mappedLiveSchedules.length === 0 && !isLoading && (
          <div className="mb-6 p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground flex items-center gap-3">
             <Calendar className="w-4 h-4 text-primary" />
             <span>Showing scheduled season structure. Live game times will be updated when finalized.</span>
          </div>
        )}

        <div className="space-y-8">
          {displayData.map((day) => (
            <ScheduleDayCard key={`${day.leagueId}-${day.date}`} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
};

function ScheduleDayCard({ day }: { day: ScheduleDay }) {
  const league = getLeagueConfig(day.leagueId);
  const dateObj = new Date(day.date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-card via-card to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <img
              src={league.logo}
              alt={league.logoAlt}
              width={32}
              height={32}
              className="flex-shrink-0"
              style={{ aspectRatio: '1/1' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <div className="flex items-center gap-2">
                <LeagueBadge leagueId={day.leagueId} size="sm" />
                <span className="text-xs text-muted-foreground">{day.season} &middot; Week {day.week}</span>
              </div>
              <p className="font-display text-lg font-bold mt-0.5">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{day.venue}, {day.address}</span>
          </div>
        </div>
      </div>

      {/* Courts */}
      <div className="divide-y divide-border">
        {day.courts.map((court) => (
          <div key={court.name} className="px-5 py-4">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary mb-3">{court.name}</h3>
            <div className="space-y-2">
              {court.games.map((game, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-sm bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{game.time}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{game.home}</span>
                    <span className="text-[10px] font-bold text-primary flex-shrink-0">VS</span>
                    <span className="text-sm font-medium truncate">{game.away}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SchedulesPage;
