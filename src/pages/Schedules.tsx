import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig, getLeagueSeasonLabel } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicSchedule } from '@/lib/api/public';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SBBL_WEEK4_MAY_10_2026 } from '@/data/sbblWeek4Schedule';

type ScheduleGame = { time: string; home: string; away: string };
type ScheduleCourt = { name: string; games: ScheduleGame[] };
type ScheduleDay = {
  leagueId: LeagueId;
  season: string;
  week: string;
  date: string;
  venue: string;
  address: string;
  courts: ScheduleCourt[];
};


function formatScheduleTime(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return 'TBA';
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

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
  const liveSchedules = useMemo(() => liveDataRes?.data || [], [liveDataRes?.data]);

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

  // Safely map live schedules into ScheduleDay shape if we have them
  // Group by league and date, then court
  const mappedLiveSchedules: ScheduleDay[] = useMemo(() => {
    if (!liveSchedules || liveSchedules.length === 0) return [];

    // Normalize known worker payload variants (starts_at/start_time + team labels/ids).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupedLive = liveSchedules.reduce((acc: Record<string, any>, curr: any) => {
      const startsAt = curr.starts_at || curr.start_time;
      if (!startsAt || typeof startsAt !== 'string') return acc;
      const gameDate = startsAt.split('T')[0];
      const key = `${curr.league_id || 'sbbl'}-${gameDate}`;
      if (!acc[key]) {
        const leagueId = LEAGUE_REGISTRY.some((l) => l.id === curr.league_id)
          ? (curr.league_id as LeagueId)
          : 'sbbl';
        acc[key] = {
          leagueId,
          season: getLeagueSeasonLabel(leagueId),
          week: String(curr.week || '1'),
          date: gameDate,
          venue: curr.venue || 'TBA',
          address: curr.address || 'TBA',
          courts: {}
        };
      }
      const courtName = curr.court || curr.court_name || 'Main Court';
      if (!acc[key].courts[courtName]) acc[key].courts[courtName] = [];
      const time = formatScheduleTime(startsAt);
      acc[key].courts[courtName].push({
        time,
        home: curr.home_team_name || curr.home_team || curr.home_team_id || 'TBA',
        away: curr.away_team_name || curr.away_team || curr.away_team_id || 'TBA'
      });
      return acc;
    }, {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.values(groupedLive).map((g: any) => ({
      ...g,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      courts: Object.entries(g.courts).map(([name, games]) => ({ name, games: games as any[] }))
    }));
  }, [liveSchedules]);

  const displayData = useMemo(() => {
    if (leagueFilter !== 'all' && leagueFilter !== 'sbbl') return mappedLiveSchedules;
    const hasWeek4 = mappedLiveSchedules.some((day) => day.date === SBBL_WEEK4_MAY_10_2026.date && day.leagueId === 'sbbl');
    return hasWeek4 ? mappedLiveSchedules : [...mappedLiveSchedules, SBBL_WEEK4_MAY_10_2026];
  }, [mappedLiveSchedules, leagueFilter]);


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

        {displayData.length === 0 && !isLoading && (
          <div className="panel p-8 text-center">
            <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold">No games scheduled</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Fixtures will appear here as leagues publish their schedules.
            </p>
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
