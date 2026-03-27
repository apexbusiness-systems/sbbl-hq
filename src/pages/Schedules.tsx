import { useState } from 'react';
import { games, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { useApp } from '@/contexts/AppContext';
import { LeagueId, GameStatus } from '@/types';
import { Calendar, Filter } from 'lucide-react';

const statusColors: Record<GameStatus, string> = {
  live: 'text-live',
  upcoming: 'text-foreground',
  final: 'text-muted-foreground',
  postponed: 'text-warning',
  review_pending: 'text-warning',
};

const statusLabels: Record<GameStatus, string> = {
  live: '● Live',
  upcoming: 'Upcoming',
  final: 'Final',
  postponed: 'Postponed',
  review_pending: 'Under Review',
};

const SchedulesPage = () => {
  const { activeLeague } = useApp();
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GameStatus | 'all'>('all');

  const filtered = games.filter(g => {
    if (leagueFilter !== 'all' && g.leagueId !== leagueFilter) return false;
    if (statusFilter !== 'all' && g.status !== statusFilter) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, g) => {
    const key = g.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {} as Record<string, typeof games>);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Schedules</h1>
            <p className="text-sm text-muted-foreground mt-1">All games across leagues</p>
          </div>
          <Calendar className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="flex gap-1 p-1 bg-secondary rounded-sm">
            {(['all', 'sbbl', 'wbl', 'tgifbl'] as const).map(l => (
              <button key={l} onClick={() => setLeagueFilter(l)} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${leagueFilter === l ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
                {l === 'all' ? 'All' : l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 bg-secondary rounded-sm">
            {(['all', 'live', 'upcoming', 'final'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${statusFilter === s ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule List */}
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateGames]) => (
            <div key={date}>
              <div className="sticky top-[5.5rem] z-10 bg-background/95 backdrop-blur-sm py-2 mb-3">
                <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <div className="space-y-2">
                {dateGames.map(g => (
                  <div key={g.id} className="panel p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-3 md:w-32">
                      <LeagueBadge leagueId={g.leagueId} />
                      <span className={`text-xs font-semibold ${statusColors[g.status]}`}>{statusLabels[g.status]}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 text-right">
                        <p className="text-sm font-medium">{g.homeTeam.name}</p>
                        <p className="text-[10px] text-muted-foreground">{g.homeTeam.record.wins}-{g.homeTeam.record.losses}</p>
                      </div>
                      {g.score ? (
                        <div className="flex items-center gap-2 px-3">
                          <span className={`stat-numeral text-xl ${g.status === 'live' ? 'text-live' : 'text-foreground'}`}>{g.score.home}</span>
                          <span className="text-xs text-muted-foreground">—</span>
                          <span className={`stat-numeral text-xl ${g.status === 'live' ? 'text-live' : 'text-foreground'}`}>{g.score.away}</span>
                        </div>
                      ) : (
                        <div className="px-3">
                          <span className="stat-numeral text-sm text-muted-foreground">{g.time}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{g.awayTeam.name}</p>
                        <p className="text-[10px] text-muted-foreground">{g.awayTeam.record.wins}-{g.awayTeam.record.losses}</p>
                      </div>
                    </div>
                    <div className="text-right md:w-40">
                      <p className="text-xs text-muted-foreground">{g.venue}</p>
                      <p className="text-[10px] text-muted-foreground">{g.court}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulesPage;
