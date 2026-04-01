import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { SCHEDULE_DATA, type ScheduleDay } from '@/data/schedules';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId } from '@/types';
import { Calendar, MapPin, Clock, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type ApiScheduleSlot = {
  id: string; starts_at: string; ends_at: string | null; status: string;
  court: string | null;
  games: Array<{ id: string; home_team_id?: string; away_team_id?: string; home_score?: number; away_score?: number; status?: string }>;
};

type ApiScheduleDay = {
  date: string; league_code: string; league_name: string; season_name: string;
  venue: string | null; venue_address: string | null; slots: ApiScheduleSlot[];
};

function mapApiDay(d: ApiScheduleDay): ScheduleDay {
  return {
    leagueId: LEAGUE_REGISTRY.find(l => l.code === d.league_code)?.id as LeagueId ?? 'sbbl',
    leagueCode: d.league_code, season: d.season_name, week: 0, date: d.date,
    venue: d.venue ?? '', address: d.venue_address ?? '',
    courts: [{
      name: d.slots[0]?.court ?? 'Main Court',
      games: d.slots.map(s => ({
        time: s.starts_at.split('T')[1]?.slice(0, 5) ?? '',
        home: s.games[0]?.home_team_id ?? 'TBD',
        away: s.games[0]?.away_team_id ?? 'TBD',
        court: s.court ?? '',
      })),
    }],
  };
}

type GameRow = { time: string; home: string; away: string; court: string };
type CourtSection = { name: string; games: GameRow[] };

const ScheduleDayCard = ({ day }: { day: ScheduleDay }) => {
  const league = getLeagueConfig(day.leagueId);
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border p-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LeagueBadge leagueId={day.leagueId} />
            <span className="text-xs text-muted-foreground">{day.season}</span>
            {day.week > 0 && <span className="text-xs text-muted-foreground">· Week {day.week}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-lg">
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{day.venue}</p>
          {day.address && <p className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {day.address}</p>}
        </div>
      </div>
      <div className="divide-y divide-border">
        {day.courts.map((court: CourtSection, ci: number) => (
          <div key={ci} className="p-4">
            {day.courts.length > 1 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">{court.name}</p>}
            <div className="space-y-2">
              {court.games.map((game: GameRow, gi: number) => (
                <div key={gi} className="grid grid-cols-[auto_1fr_auto_1fr] md:grid-cols-[80px_1fr_32px_1fr_auto] gap-2 items-center py-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span className="font-mono">{game.time}</span></div>
                  <p className="text-sm font-medium text-right truncate">{game.home}</p>
                  <p className="text-[10px] font-bold text-muted-foreground text-center">vs</p>
                  <p className="text-sm font-medium truncate">{game.away}</p>
                  {game.court && <span className="hidden md:block text-[10px] text-muted-foreground px-2 py-0.5 border border-border rounded-sm whitespace-nowrap">{game.court}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SchedulesPage = () => {
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>('all');

  const scheduleQuery = useQuery({
    queryKey: ['public-schedule', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; days: ApiScheduleDay[] }>('/api/public/schedule'),
    staleTime: 60_000, retry: 1,
  });

  const scheduleData = useMemo<ScheduleDay[]>(() => {
    const apiDays = scheduleQuery.data?.days;
    if (Array.isArray(apiDays) && apiDays.length > 0) {
      const mapped = apiDays.map(mapApiDay);
      return leagueFilter === 'all' ? mapped : mapped.filter(d => d.leagueId === leagueFilter);
    }
    // Fallback to curated static schedule when DB is empty
    return leagueFilter === 'all' ? SCHEDULE_DATA : SCHEDULE_DATA.filter(s => s.leagueId === leagueFilter);
  }, [scheduleQuery.data, leagueFilter]);

  const usingStaticFallback = !scheduleQuery.data?.days?.length && !scheduleQuery.isPending;

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

        {usingStaticFallback && scheduleData.length > 0 && (
          <div className="mb-6 flex items-start gap-2 p-3 bg-secondary border border-border rounded-sm text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Showing manually curated schedule. Live schedule data will populate here once the database is seeded via the Ops console.</span>
          </div>
        )}

        <div className="flex gap-1 p-1 bg-secondary rounded-sm mb-8 w-fit">
          <button onClick={() => setLeagueFilter('all')} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>All</button>
          {LEAGUE_REGISTRY.map(l => (
            <button key={l.id} onClick={() => setLeagueFilter(l.id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors min-h-[36px] ${leagueFilter === l.id ? `bg-card ${l.accentClass} border border-current/20` : 'text-muted-foreground'}`}>
              <img src={l.logo} alt="" width={12} height={12} className="flex-shrink-0 opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {l.shortName}
            </button>
          ))}
        </div>

        {scheduleQuery.isPending && (
          <div className="panel p-8 text-center"><Calendar className="w-8 h-8 text-primary/40 mx-auto mb-3 animate-pulse" /><p className="text-sm text-muted-foreground">Loading schedules…</p></div>
        )}

        {!scheduleQuery.isPending && scheduleData.length === 0 && (
          <div className="panel p-8 text-center">
            <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold">No Schedules Yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">Game schedules will appear here as leagues publish their fixtures.</p>
          </div>
        )}

        <div className="space-y-8">
          {scheduleData.map(day => <ScheduleDayCard key={`${day.leagueId}-${day.date}`} day={day} />)}
        </div>
      </div>
    </div>
  );
};

export default SchedulesPage;
