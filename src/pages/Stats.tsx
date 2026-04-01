import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { ArrowUpDown, BarChart3, Lock, LogIn } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type StatKey = keyof StatLine;
const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'fls', 'min'];
const statLabels: Record<StatKey, string> = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fls: 'FLS', min: 'MIN' };

const StatsAuthGate = () => (
  <div className="panel p-10 text-center max-w-sm mx-auto mt-8">
    <Lock className="w-8 h-8 text-primary mx-auto mb-4" />
    <h2 className="font-display text-xl font-bold mb-2">Sign in to view stats</h2>
    <p className="text-sm text-muted-foreground mb-6">
      Player statistics are available to registered SBBL HQ members.
    </p>
    <Link to="/login" className="gold-bg inline-flex items-center gap-2 px-5 py-2.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm">
      <LogIn className="w-4 h-4" /> Sign In
    </Link>
  </div>
);

const StatsEmptyState = ({ loading }: { loading: boolean }) => (
  <div className="panel p-10 text-center max-w-sm mx-auto mt-8">
    <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
    <h2 className="font-display text-xl font-bold mb-2">
      {loading ? 'Loading stats…' : 'No stats recorded yet'}
    </h2>
    <p className="text-sm text-muted-foreground">
      {loading
        ? 'Fetching player statistics from the database.'
        : 'Player stats will appear here once game results are finalized by league operations.'}
    </p>
  </div>
);

const StatsPage = () => {
  const { hasPremiumPlayerAccess, activeLeague } = useApp();
  const { isSignedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<StatKey>('pts');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const paramLeague = searchParams.get('league');
  const initialFilter: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all') : activeLeague;
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

  // Auth-gated query. Unauthenticated users see the gate, not mock data.
  const statsQuery = useQuery({
    queryKey: ['stats', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
    enabled: !!isSignedIn,
    retry: 1,
    staleTime: 30_000,
  });

  // Zero mock fallback — empty array triggers the empty state UI.
  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = statsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) return apiData;
    return [];
  }, [statsQuery.data]);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
  }, [leagueFilter, sortBy, players]);

  const visibleRows = hasPremiumPlayerAccess ? filtered : filtered.slice(0, 3);
  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;
  const maxStat = (key: StatKey) => Math.max(1, ...filtered.map(p => p.stats[key]));
  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;
  const isLoading = statsQuery.isPending && isSignedIn;

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Stats</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leagueFilter === 'all' ? 'Player statistics across all leagues' : `${activeLeagueObj?.name ?? leagueFilter.toUpperCase()} player statistics`}
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>

        {!isSignedIn && <StatsAuthGate />}

        {isSignedIn && (
          <>
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex gap-1 p-1 bg-secondary rounded-sm overflow-x-auto">
                <button onClick={() => handleFilterChange('all')} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${leagueFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>All Org</button>
                {LEAGUE_REGISTRY.map(l => (
                  <button key={l.id} onClick={() => handleFilterChange(l.id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap ${leagueFilter === l.id ? `bg-card ${l.accentClass} border border-current/20` : 'text-muted-foreground hover:text-foreground'}`}>
                    <img src={l.logo} alt="" width={14} height={14} className="flex-shrink-0 opacity-80" style={{ aspectRatio: '1/1' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    {l.shortName}
                  </button>
                ))}
              </div>
            </div>

            {(isLoading || filtered.length === 0) && <StatsEmptyState loading={isLoading} />}

            {!isLoading && filtered.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 text-xs text-muted-foreground font-medium">Player</th>
                            {statKeys.map(k => (
                              <th key={k} className="p-3 text-center cursor-pointer" onClick={() => setSortBy(k)}>
                                <span className={`text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 ${sortBy === k ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {statLabels[k]} {sortBy === k && <ArrowUpDown className="w-3 h-3" />}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map(p => (
                            <tr key={p.id} onClick={() => setSelectedPlayer(p.id)} className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/50 ${selectedPlayer === p.id ? 'bg-secondary' : ''}`}>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=111111&color=C9A84C`; }} />
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
                    {!hasPremiumPlayerAccess && filtered.length > 3 && (
                      <div className="p-4 border-t border-border bg-secondary/40 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Showing 3 of {filtered.length} players. Active $7 registration unlocks the full table.</p>
                        <Link to="/billing" className="inline-flex items-center gap-1 text-xs text-primary font-semibold whitespace-nowrap"><Lock className="w-3 h-3" /> Unlock</Link>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  {detail && hasPremiumPlayerAccess ? (
                    <div className="panel p-4 sticky top-24 space-y-4">
                      <div className="flex items-center gap-3">
                        <img src={detail.avatar} alt={detail.name} className="w-16 h-16 rounded-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(detail.name)}&background=111111&color=C9A84C`; }} />
                        <div>
                          <h3 className="font-display font-bold">{detail.name}</h3>
                          <p className="text-xs text-muted-foreground">{detail.position} · #{detail.number}</p>
                          <LeagueBadge leagueId={detail.leagueId} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {statKeys.map(k => {
                          const val = detail.stats[k];
                          const max = maxStat(k);
                          const circumference = 2 * Math.PI * 28;
                          const dashOffset = circumference - ((max > 0 ? val / max : 0) * circumference);
                          return (
                            <div key={k} className="flex flex-col items-center p-3 bg-secondary rounded-sm">
                              <svg width="64" height="64" viewBox="0 0 64 64">
                                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" transform="rotate(-90 32 32)" className="transition-all duration-500" />
                                <text x="32" y="32" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--foreground))" fontSize="14" fontWeight="700">{val}</text>
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
                        {hasPremiumPlayerAccess ? 'Select a player to view their full stat breakdown.' : 'Active player registration unlocks full stat breakdowns.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StatsPage;
