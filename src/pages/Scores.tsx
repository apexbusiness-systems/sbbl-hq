import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import type { LeagueId, ScoreCategory, ScoreEntry } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, Users, Star } from 'lucide-react';
import { fetchScores } from '@/lib/api/scores';
// ScoreCard is memoized — prevents grid re-renders on filter state changes
import { ScoreCard } from '@/components/scores/ScoreCard';

// ── Category config ────────────────────────────────────────────────────────
const CATEGORIES: Array<{ id: ScoreCategory | 'all'; label: string; icon: typeof Trophy }> = [
  { id: 'all',           label: 'All',            icon: Trophy },
  { id: 'league',        label: 'League',         icon: Trophy },
  { id: '1v1',           label: '1-on-1',         icon: Users  },
  { id: 'special_event', label: 'Special Events', icon: Star   },
];

const STATUS_FILTERS = [
  { id: 'all',      label: 'All'      },
  { id: 'recent',   label: 'Recent'   },
  { id: 'upcoming', label: 'Upcoming' },
] as const;

// ── Main page ──────────────────────────────────────────────────────────────
const ScoresPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeLeague, setActiveLeague } = useApp();

  const paramLeague   = searchParams.get('league')   as LeagueId | 'all' | null;
  const paramCategory = searchParams.get('category') as ScoreCategory | 'all' | null;

  const isValidLeague = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));
  const isValidCat    = paramCategory && CATEGORIES.some((c) => c.id === paramCategory);

  const [category,     setCategory]     = useState<ScoreCategory | 'all'>(isValidCat    ? paramCategory! : 'all');
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(isValidLeague ? paramLeague! : activeLeague || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recent' | 'upcoming'>('all');

  useEffect(() => {
    if (isValidCat)    setCategory(paramCategory! as ScoreCategory | 'all');
    if (isValidLeague) setLeagueFilter(paramLeague! as LeagueId | 'all');
    else if (activeLeague) setLeagueFilter(activeLeague);
  }, [activeLeague, paramCategory, paramLeague, isValidCat, isValidLeague]);

  const updateFilters = (cat: ScoreCategory | 'all', league: LeagueId | 'all') => {
    const sp: Record<string, string> = { category: cat };
    if (league !== 'all') sp.league = league;
    setSearchParams(sp, { replace: true });
  };

  const handleCategoryChange = (val: ScoreCategory | 'all') => {
    setCategory(val);
    updateFilters(val, leagueFilter);
  };

  const handleLeagueChange = (val: LeagueId | 'all') => {
    setLeagueFilter(val);
    if (val !== 'all') setActiveLeague(val);
    updateFilters(category, val);
  };

  // FIX: Static queryKey — fetch ALL games once, filter entirely client-side.
  // ROOT CAUSE: Per-filter queryKey (['scores', category, leagueFilter, statusFilter])
  // caused N separate network requests per filter combination. Any failed request
  // left that filter combo in an error/empty state independent of other combos,
  // producing inconsistent renders (e.g. 'All' shows data but 'WBL+Recent' is blank).
  // statusFilter was local state (not in URL), so its cache entries were orphaned
  // across navigations, preventing proper revalidation.
  // CHANGE: Single static key ['scores'] fetches all data once. Client-side useMemo
  // handles all filtering without extra round-trips.
  const scoresQuery = useQuery({
    queryKey: ['scores'],
    queryFn: () => fetchScores(),
    staleTime: 60_000,
  });

  const gamesData = useMemo(() => {
    const all = scoresQuery.data?.games ?? [];
    return all.filter((g) => {
      const catMatch =
        category === 'all' || g.category === category;
      const leagueMatch =
        leagueFilter === 'all' ||
        g.leagueId === leagueFilter ||
        (g.leagueCode ?? '').toLowerCase() === leagueFilter.toLowerCase();
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'recent' && g.status === 'final') ||
        (statusFilter === 'upcoming' && ['upcoming', 'scheduled'].includes(g.status));
      return catMatch && leagueMatch && statusMatch;
    });
  }, [scoresQuery.data?.games, category, leagueFilter, statusFilter]);

  // Group by category when viewing "All"
  const grouped = useMemo(() => {
    if (category !== 'all') return { [category]: gamesData } as Record<string, ScoreEntry[]>;
    return gamesData.reduce<Record<string, ScoreEntry[]>>((acc, g) => {
      (acc[g.category] ??= []).push(g);
      return acc;
    }, {});
  }, [gamesData, category]);

  const hasGames = gamesData.length > 0;

  const sectionLabel: Record<string, string> = {
    league:        'League Games',
    '1v1':         '1-on-1',
    special_event: 'Special Events',
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Scores</h1>
          <p className="text-sm text-muted-foreground mt-1">League games, 1-on-1 matchups, and special events.</p>
        </div>
        <Trophy className="w-5 h-5 text-primary" />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8">
        {/* Category */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleCategoryChange(id as ScoreCategory | 'all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                category === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* League filter — shown when category includes league games */}
        {(category === 'all' || category === 'league') && (
          <div className="flex gap-1 p-1 bg-secondary rounded-sm">
            <button
              onClick={() => handleLeagueChange('all')}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                leagueFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {LEAGUE_REGISTRY.map((l) => (
              <button
                key={l.id}
                onClick={() => handleLeagueChange(l.id)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  leagueFilter === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l.shortName}
              </button>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-1 p-1 bg-secondary rounded-sm ml-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                statusFilter === s.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {scoresQuery.isLoading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading scores…</p>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────── */}
      {!scoresQuery.isLoading && scoresQuery.isError && (
        <div className="panel p-12 text-center">
          <Trophy className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">Failed to load scores</p>
          <p className="text-sm text-muted-foreground mb-4">
            {scoresQuery.error instanceof Error ? scoresQuery.error.message : 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => scoresQuery.refetch()}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!scoresQuery.isLoading && !scoresQuery.isError && !hasGames && (
        <div className="panel p-12 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">No scores found</p>
          <p className="text-sm text-muted-foreground">
            {category !== 'all'
              ? `No ${sectionLabel[category] ?? category} results match the current filters.`
              : leagueFilter !== 'all'
              ? `No results for ${getLeagueConfig(leagueFilter as LeagueId)?.name ?? leagueFilter} yet.`
              : 'Check back after games have been played.'}
          </p>
        </div>
      )}

      {/* ── Game grid ────────────────────────────────────────────────── */}
      {!scoresQuery.isLoading && hasGames && (
        <div className="space-y-8">
          {(Object.entries(grouped) as [string, ScoreEntry[]][]).map(([cat, entries]) => (
            <section key={cat}>
              {/* Section header only shown in "All" view */}
              {category === 'all' && (
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold text-base uppercase tracking-wider text-foreground">
                    {sectionLabel[cat] ?? cat}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{entries.length} game{entries.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {entries.map((entry) => (
                  <ScoreCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
    </div>
  );
};

export default ScoresPage;
