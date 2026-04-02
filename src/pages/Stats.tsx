import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { players as mockPlayers } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { ArrowUpDown, BarChart3, Lock } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type StatKey = keyof StatLine;
const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'fls', 'min'];
const statLabels: Record<StatKey, string> = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fls: 'FLS', min: 'MIN' };

const StatsPage = () => {
  const { hasPremiumPlayerAccess, activeLeague } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<StatKey>('pts');
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
    setSearchParams(val === 'all' ? {} : { league: val }, { replace: true });
  };

  useEffect(() => {
    if (paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch live stats from the worker; fall back to mock if API unavailable or returns empty
  const statsQuery = useQuery({
    queryKey: ['stats', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
    retry: 1,
    staleTime: 30_000,
  });

  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = statsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) {
      return apiData;
    }
    return mockPlayers;
  }, [statsQuery.data]);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
  }, [leagueFilter, sortBy, players]);
  const visibleRows = hasPremiumPlayerAccess ? filtered : filtered.slice(0, 3);

  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;

  const maxStat = (key: StatKey) => Math.max(...filtered.map(p => p.stats[key]));

  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;

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
            {filtered.length === 0 ? (
              <div className="panel p-8 text-center border-dashed">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No player stats available for this league yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Stats will populate once games are recorded through the Ops pipeline.</p>
              </div>
            ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-xs text-muted-foreground font-medium">Player</th>
                      {statKeys.map(k => (
                        <th key={k} className="p-3 text-center cursor-pointer group" onClick={() => setSortBy(k)}>
                          <span className={`text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 ${sortBy === k ? 'text-primary' : 'text-muted-foreground'}`}>
                            {statLabels[k]}
                            {sortBy === k && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((p, i) => (
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
                            <span className={`stat-numeral text-sm ${sortBy === k ? 'text-primary' : ''}`}>{p.stats[k]}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!hasPremiumPlayerAccess && (
                <div className="p-4 border-t border-border bg-secondary/40 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    Showing minimal stats preview. Players with an active $7 registration tier get full sortable stats and player detail access.
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold"><Lock className="w-3 h-3" /> Premium Player Stats</span>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Player Detail Panel */}
          <div>
            {detail && hasPremiumPlayerAccess ? (
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
                  {hasPremiumPlayerAccess ? 'Select a player to view stat breakdown' : 'Upgrade to active player tier to unlock full stat breakdowns and all player profiles.'}
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
