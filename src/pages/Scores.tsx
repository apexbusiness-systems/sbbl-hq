import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { LeagueId, Game } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';

const ScoresPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramLeague = searchParams.get('league') as LeagueId | 'all' | null;
  const { activeLeague, setActiveLeague } = useApp();

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some((l) => l.id === paramLeague));

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(
    isValidParam
      ? (paramLeague as LeagueId | 'all')
      : (activeLeague || 'all')
  );

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

  // Use the public home games endpoint to fetch games
  const gamesQuery = useQuery({
    queryKey: ['public-home-games', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; latestGames: Game[] }>(
      leagueFilter === 'all' ? '/api/public/home' : `/api/public/home?leagueId=${leagueFilter}`
    ),
    staleTime: 60_000,
  });

  // Limit rendering to a neat landing amount (e.g. 8)
  const renderedGames = useMemo(() => {
    const raw = gamesQuery.data?.latestGames ?? [];
    return raw.slice(0, 8);
  }, [gamesQuery.data]);

  return (
    <div className="container py-8 md:py-12 min-h-[70vh]">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Scores</h1>
        <p className="text-sm text-muted-foreground mt-1">Current week's final and live scores</p>
      </div>

      <div className="flex bg-secondary p-1 rounded-sm w-fit mb-8">
        {[{ id: 'all', name: 'All Leagues' }, ...LEAGUE_REGISTRY].map((l) => (
          <button
            key={l.id}
            onClick={() => handleLeagueFilterChange(l.id as LeagueId | 'all')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${
              leagueFilter === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {('shortName' in l ? l.shortName : l.name)}
          </button>
        ))}
      </div>

      {gamesQuery.isLoading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading scores...</p>
        </div>
      )}

      {!gamesQuery.isLoading && renderedGames.length === 0 && (
        <div className="panel p-12 text-center">
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold">No games this week</p>
          <p className="text-sm text-muted-foreground">Check back later for {leagueFilter === 'all' ? 'league' : getLeagueConfig(leagueFilter as LeagueId)?.name} results.</p>
        </div>
      )}

      {!gamesQuery.isLoading && renderedGames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderedGames.map((g) => (
            <div key={g.id} className="panel p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{g.status === 'live' ? 'Live' : g.status === 'final' ? 'Final' : g.date}</span>
                <LeagueBadge leagueId={g.leagueId} size="sm" />
              </div>

              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm truncate pr-2">{g.awayTeam.name}</span>
                  <span className={`stat-numeral text-lg ${g.status === 'upcoming' ? 'text-muted-foreground opacity-50' : ''}`}>{g.score?.away ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm truncate pr-2">{g.homeTeam.name}</span>
                  <span className={`stat-numeral text-lg ${g.status === 'upcoming' ? 'text-muted-foreground opacity-50' : ''}`}>{g.score?.home ?? '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoresPage;
