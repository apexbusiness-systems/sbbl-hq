import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { Trophy, Crown, Medal, Lock, LogIn } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type StatKey = keyof StatLine;
const categories: { key: StatKey; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
  { key: 'fls', label: 'Fouls' },
  { key: 'min', label: 'Minutes' },
];

const LeaderboardsPage = () => {
  const { activeLeague, setActiveLeague } = useApp();
  const { session, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<StatKey>('pts');

  // Initialise from URL param; fall back to current active league
  const paramLeague = searchParams.get('league');
  const initialFilter: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all')
      : activeLeague;

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(initialFilter);

  // Keep URL in sync when filter changes
  const handleFilterChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
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

  // Leaderboards are a premium surface — only registered paid players,
  // coaches, team managers, league admins, and super admins may view them
  // (see docs/protocols/no-mock-in-production.md § Leaderboard access).
  //
  // Authorization is enforced server-side at /api/leaderboards:
  //   • unauthenticated → 401 ("reauth_required")
  //   • authenticated but not eligible → 403 ("forbidden")
  //   • eligible → 200 with tier='full' and the full stat line
  //
  // We skip the fetch entirely when the user has no session (avoids a
  // guaranteed 401 round-trip) and render a sign-in gate instead.
  const leaderboardsQuery = useQuery({
    queryKey: ['leaderboards', leagueFilter],
    queryFn: () =>
      apiFetch<{ ok: boolean; tier: 'full'; data: PlayerProfile[] }>('/api/leaderboards'),
    retry: false,
    enabled: !authLoading && Boolean(session),
    staleTime: 30_000,
  });

  const queryError = leaderboardsQuery.error instanceof Error ? leaderboardsQuery.error.message : null;
  const isUnauthorised = !authLoading && !session;
  const isForbidden = queryError === 'forbidden';
  const isReauthRequired = queryError === 'reauth_required';
  const isGated = isUnauthorised || isForbidden || isReauthRequired;

  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = leaderboardsQuery.data?.data;
    if (Array.isArray(apiData)) return apiData;
    return [];
  }, [leaderboardsQuery.data]);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => {
      const aVal = a.stats[activeCategory] ?? 0;
      const bVal = b.stats[activeCategory] ?? 0;
      return bVal - aVal;
    });
  }, [leagueFilter, activeCategory, players]);
  const visible = filtered;

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-primary" />;
    if (i === 1) return <Medal className="w-4 h-4 text-wbl" />;
    if (i === 2) return <Medal className="w-4 h-4 text-tgifbl" />;
    return <span className="stat-numeral text-sm text-muted-foreground w-4 text-center">{i + 1}</span>;
  };

  const activeLeagueObj = leagueFilter === 'all' ? null : LEAGUE_REGISTRY.find(l => l.id === leagueFilter);

  const activeCategoryLabel = useMemo(() => {
    return categories.find(c => c.key === activeCategory)?.label || '';
  }, [activeCategory]);

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Leaderboards</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leagueFilter === 'all'
                ? 'Top performers across all three leagues'
                : `${activeLeagueObj?.name ?? leagueFilter.toUpperCase()} — league leaders`}
            </p>
          </div>
          <Trophy className="w-5 h-5 text-primary" />
        </div>

        {/* League filter — LEAGUE_REGISTRY driven with logos */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm w-fit mb-6 overflow-x-auto">
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

        {/* Category tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hidden pb-2">
          {categories.map(c => (
            <button key={c.key} onClick={() => setActiveCategory(c.key)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${activeCategory === c.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="max-w-3xl">
          {isGated && (
            <div className="panel p-12 text-center space-y-4">
              <Lock className="w-10 h-10 text-primary/60 mx-auto" />
              <h2 className="font-display text-xl font-bold">Leaderboards locked</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {isUnauthorised || isReauthRequired
                  ? 'Sign in with an active player, coach, or admin account to view full league leaderboards.'
                  : 'Your account does not have leaderboard access. Leaderboards are available to registered paid players, coaches, team managers, league admins, and super admins.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                {(isUnauthorised || isReauthRequired) && (
                  <Link to="/login" className="gold-bg px-5 py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center gap-2">
                    <LogIn className="w-4 h-4" /> Sign in
                  </Link>
                )}
                <Link to="/onboarding" className="px-5 py-2.5 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors font-display font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center gap-2">
                  Become a player
                </Link>
              </div>
            </div>
          )}

          {!isGated && leaderboardsQuery.isLoading && (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading leaderboards…</p>
            </div>
          )}

          {!isGated && !leaderboardsQuery.isLoading && visible.length === 0 && (
            <div className="panel p-12 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold mb-1">No leaders yet</p>
              <p className="text-sm text-muted-foreground">
                Stats will appear once games have been played.
              </p>
            </div>
          )}

          {/* Top 3 Spotlight */}
          {!isGated && visible.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {visible.slice(0, 3).map((p, i) => (
                <div key={p.id} className={`panel p-4 text-center ${i === 0 ? 'border-primary/30' : ''}`}>
                  <div className="flex justify-center mb-2">{rankIcon(i)}</div>
                  <img src={p.avatar} alt={p.name} className="w-16 h-16 rounded-full object-cover mx-auto mb-2" loading="lazy" />
                  <p className="font-display font-bold text-sm">{p.name}</p>
                  <LeagueBadge leagueId={p.leagueId} />
                  <p className="stat-numeral text-3xl text-primary mt-2">{p.stats[activeCategory] ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{activeCategoryLabel}</p>
                </div>
              ))}
            </div>
          )}

          {/* Full list */}
          {!isGated && (
            <div className="space-y-2">
              {visible.map((p, i) => {
                const leaderTop = visible[0]?.stats[activeCategory] ?? 0;
                const value = p.stats[activeCategory] ?? 0;
                return (
                  <div key={p.id} className={`panel p-3 flex items-center gap-4 ${i < 3 ? 'border-primary/20' : ''}`}>
                    <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                    <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <LeagueBadge leagueId={p.leagueId} />
                        <span className="text-[10px] text-muted-foreground">{p.position}{(p as { teamName?: string | null }).teamName ? ` · ${(p as { teamName?: string | null }).teamName}` : ''}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="stat-numeral text-xl text-primary">{value}</p>
                    </div>
                    {/* Mini stat bar */}
                    <div className="hidden md:block w-24">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: leaderTop > 0 ? `${(value / leaderTop) * 100}%` : '0%' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardsPage;
