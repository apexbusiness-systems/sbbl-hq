import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { BarChart3 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { players as mockPlayers } from '@/data/mock';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type StatKey = keyof StatLine;
const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'fls', 'min'];
const statLabels: Record<StatKey, string> = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fls: 'FLS', min: 'MIN' };

const StatsPage = () => {
  const { activeLeague, setActiveLeague } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Initialise from URL param; fall back to current active league
  const paramLeague = searchParams.get('league');
  const initialFilter: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all')
      : activeLeague;

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(initialFilter);

  const handleFilterChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    setSelectedPlayer(null);
    if (val !== 'all') setActiveLeague(val);
    setSearchParams({ league: val }, { replace: true });
  };

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague));

  useEffect(() => {
    if (isValidParam) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague, isValidParam]);

  // Fetch live stats from the worker
  const statsQuery = useQuery({
    queryKey: ['stats', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
    retry: 1,
    staleTime: 30_000,
  });

  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = statsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0) {
      return apiData;
    }
    return mockPlayers;
  }, [statsQuery.data]);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [leagueFilter, players]);
  const visibleRows = filtered;

  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;

  const maxStat = (key: StatKey) => Math.max(...filtered.map(p => p.stats[key]));

  const activeLeagueObj = leagueFilter === 'all' ? null : LEAGUE_REGISTRY.find(l => l.id === leagueFilter);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Stats</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leagueFilter === 'all'
                ? 'Player statistics across all leagues'
                : `${activeLeagueObj?.name ?? leagueFilter.toUpperCase()} player statistics`}
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Filters — LEAGUE_REGISTRY driven with logos */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex gap-1 p-1 bg-secondary rounded-sm overflow-x-auto">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All Org
            </button>
            {LEAGUE_REGISTRY.map(l => (
              <button
                key={l.id}
                onClick={() => handleFilterChange(l.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${
                  leagueFilter === l.id
                    ? `bg-card ${l.accentClass} border border-current/20`
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <img src={l.logo} alt="" width={14} height={14} className="flex-shrink-0 opacity-80" style={{ aspectRatio: '1/1' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {l.shortName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Table */}
          <div className="lg:col-span-2">
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-xs text-muted-foreground font-medium">Player</th>
                      {statKeys.map(k => (
                        <th key={k} className="p-3 text-center">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {statLabels[k]}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((p) => (
                      <tr key={p.id} onClick={() => setSelectedPlayer(p.id)} className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/50 ${selectedPlayer === p.id ? 'bg-secondary' : ''}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <div className="flex items-center gap-1">
                                <LeagueBadge leagueId={p.leagueId} />
                                <span className="text-[10px] text-muted-foreground">{p.position}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {statKeys.map(k => (
                          <td key={k} className="p-3 text-center">
                            <span className="stat-numeral text-sm">{p.stats[k]}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* Player Detail Panel */}
          <div>
            {detail ? (
              <div className="panel p-4 sticky top-24 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={detail.avatar} alt={detail.name} className="w-16 h-16 rounded-full object-cover" loading="lazy" />
                  <div>
                    <h3 className="font-display font-bold">{detail.name}</h3>
                    <p className="text-xs text-muted-foreground">{detail.position} · #{detail.number}</p>
                    <LeagueBadge leagueId={detail.leagueId} />
                  </div>
                </div>

                {/* Circular stat visuals */}
                <div className="grid grid-cols-2 gap-3">
                  {statKeys.map(k => {
                    const val = detail.stats[k];
                    const max = maxStat(k);
                    const pct = max > 0 ? (val / max) * 100 : 0;
                    const circumference = 2 * Math.PI * 28;
                    const dashOffset = circumference - (pct / 100) * circumference;
                    return (
                      <div key={k} className="flex flex-col items-center p-3 bg-secondary rounded-sm">
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" transform="rotate(-90 32 32)" className="transition-all duration-500" />
                          <text x="32" y="32" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--foreground))" fontSize="14" fontWeight="700" fontFamily="Space Grotesk, monospace">{val}</text>
                        </svg>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{statLabels[k]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="panel p-8 text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a player to view stat breakdown
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
