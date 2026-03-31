import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { players as mockPlayers, teams } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { Trophy, Crown, Medal, Lock } from 'lucide-react';
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
  const { hasPremiumPlayerAccess, activeLeague } = useApp();
  const { isSignedIn } = useAuth();
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
    setSearchParams(val === 'all' ? {} : { league: val }, { replace: true });
  };

  // If the user navigates here from a league page, pick up the param on mount
  useEffect(() => {
    if (paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch live leaderboard data from the worker; fall back to mock if API unavailable
  const leaderboardsQuery = useQuery({
    queryKey: ['leaderboards', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/leaderboards'),
    enabled: true,
    retry: 1,
    staleTime: 30_000,
  });

  const players = useMemo<PlayerProfile[]>(() => {
    const apiData = leaderboardsQuery.data?.data;
    if (Array.isArray(apiData) && apiData.length > 0 && 'stats' in (apiData[0] ?? {})) {
      return apiData;
    }
    return [];
  }, [leaderboardsQuery.data]);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => b.stats[activeCategory] - a.stats[activeCategory]);
  }, [leagueFilter, activeCategory, players]);
  const visible = hasPremiumPlayerAccess ? filtered : filtered.slice(0, 3);

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-primary" />;
    if (i === 1) return <Medal className="w-4 h-4 text-wbl" />;
    if (i === 2) return <Medal className="w-4 h-4 text-tgifbl" />;
    return <span className="stat-numeral text-sm text-muted-foreground w-4 text-center">{i + 1}</span>;
  };

  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;

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
          {/* Top 3 Spotlight */}
          {visible.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {visible.slice(0, 3).map((p, i) => (
                <div key={p.id} className={`panel p-4 text-center ${i === 0 ? 'border-primary/30' : ''}`}>
                  <div className="flex justify-center mb-2">{rankIcon(i)}</div>
                  <img src={p.avatar} alt={p.name} className="w-16 h-16 rounded-full object-cover mx-auto mb-2" loading="lazy" />
                  <p className="font-display font-bold text-sm">{p.name}</p>
                  <LeagueBadge leagueId={p.leagueId} />
                  <p className="stat-numeral text-3xl text-primary mt-2">{p.stats[activeCategory]}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{categories.find(c => c.key === activeCategory)?.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Full list */}
          <div className="space-y-2">
            {visible.map((p, i) => (
              <div key={p.id} className={`panel p-3 flex items-center gap-4 ${i < 3 ? 'border-primary/20' : ''}`}>
                <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <div className="flex items-center gap-2">
                    <LeagueBadge leagueId={p.leagueId} />
                    <span className="text-[10px] text-muted-foreground">{p.position} · {teams.find(t => t.id === p.teamId)?.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="stat-numeral text-xl text-primary">{p.stats[activeCategory]}</p>
                </div>
                {/* Mini stat bar */}
                <div className="hidden md:block w-24">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(p.stats[activeCategory] / visible[0].stats[activeCategory]) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!hasPremiumPlayerAccess && (
            <div className="mt-4 panel p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Minimal leaderboard mode is shown for fans and players without an active registration renewal.</p>
              <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold"><Lock className="w-3 h-3" /> Full rankings require active player tier</span>
            </div>
          )}

          {/* Team Standings */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Team Standings</h2>
              {leagueFilter !== 'all' && activeLeagueObj && (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <img src={activeLeagueObj.logo} alt="" width={16} height={16} className="opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className={activeLeagueObj.accentClass}>{activeLeagueObj.shortName}</span>
                </div>
              )}
              {leagueFilter === 'all' && (
                <span className="text-xs text-muted-foreground">All leagues combined</span>
              )}
            </div>
            <div className="space-y-2">
              {teams
                .filter(t => leagueFilter === 'all' || t.leagueId === leagueFilter)
                .sort((a, b) => (b.record.wins / (b.record.wins + b.record.losses)) - (a.record.wins / (a.record.wins + a.record.losses)))
                .map((t, i) => (
                  <div key={t.id} className="panel p-3 flex items-center gap-4">
                    <span className="stat-numeral text-sm text-muted-foreground w-6 text-center">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.name}</p>
                      <div className="flex items-center gap-2">
                        <LeagueBadge leagueId={t.leagueId} />
                        <span className="text-[10px] text-muted-foreground">{t.division}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="stat-numeral text-sm text-success">{t.record.wins}W</span>
                      <span className="stat-numeral text-sm text-destructive">{t.record.losses}L</span>
                      <span className="stat-numeral text-sm">{((t.record.wins / (t.record.wins + t.record.losses)) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardsPage;
