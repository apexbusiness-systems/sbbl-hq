import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useState, useMemo, useEffect, useCallback, memo, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { List, type RowComponentProps } from 'react-window';
import { players as mockPlayers, teams } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { LeagueId, StatLine, PlayerProfile } from '@/types';
import { ArrowUpDown, BarChart3, Lock } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

type StatKey = keyof StatLine;

const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'fls', 'min'];
const statLabels: Record<StatKey, string> = {
  pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fls: 'FLS', min: 'MIN',
};

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 56; // px — consistent table row height
const MAX_LIST_HEIGHT = 600; // px

// ── Memoized table row ───────────────────────────────────────────────────
interface StatsTableRowProps {
  player: PlayerProfile;
  sortBy: StatKey;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const StatsTableRow = memo(function StatsTableRow({
  player: p,
  sortBy,
  isSelected,
  onSelect,
}: StatsTableRowProps) {
  return (
    <tr
      onClick={() => onSelect(p.id)}
      className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/50 ${isSelected ? 'bg-secondary' : ''}`}
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <PlayerAvatar src={p.avatar} alt={p.name} className="w-8 h-8" />
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
          <span className={`stat-numeral text-sm ${sortBy === k ? 'text-primary' : ''}`}>
            {p.stats[k]}
          </span>
        </td>
      ))}
    </tr>
  );
});

// ── react-window v2 row wrapper for the stats table ──────────────────────
// Note: react-window requires a flat list; we render rows as divs
// when virtualizing since <tr> outside <tbody> is invalid HTML.
interface VirtualRowData {
  players: PlayerProfile[];
  sortBy: StatKey;
  selectedPlayer: string | null;
  onSelect: (id: string) => void;
}

function VirtualStatsRow({
  index,
  style,
  players,
  sortBy,
  selectedPlayer,
  onSelect,
}: RowComponentProps<VirtualRowData>): ReactElement {
  const p = players[index];
  return (
    <div
      style={style}
      onClick={() => onSelect(p.id)}
      className={`flex items-center gap-2 px-3 border-b border-border cursor-pointer transition-colors hover:bg-secondary/50 ${selectedPlayer === p.id ? 'bg-secondary' : ''}`}
    >
      <PlayerAvatar src={p.avatar} alt={p.name} className="w-8 h-8 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{p.name}</p>
        <div className="flex items-center gap-1">
          <LeagueBadge leagueId={p.leagueId} />
          <span className="text-[10px] text-muted-foreground">{p.position}</span>
        </div>
      </div>
      {statKeys.map(k => (
        <span key={k} className={`stat-numeral text-sm w-10 text-center flex-shrink-0 ${sortBy === k ? 'text-primary' : 'text-muted-foreground'}`}>
          {p.stats[k]}
        </span>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
const StatsPage = () => {
  const { hasPremiumPlayerAccess, activeLeague, setActiveLeague } = useApp();
  const { isSignedIn } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<StatKey>('pts');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const paramLeague = searchParams.get('league');
  const initialFilter: LeagueId | 'all' =
    paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague))
      ? (paramLeague as LeagueId | 'all')
      : activeLeague;

  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>(initialFilter);

  const handleFilterChange = useCallback((val: LeagueId | 'all') => {
    setLeagueFilter(val);
    setSelectedPlayer(null);
    if (val !== 'all') setActiveLeague(val);
    setSearchParams({ league: val }, { replace: true });
  }, [setActiveLeague, setSearchParams]);

  const isValidParam = paramLeague && (paramLeague === 'all' || LEAGUE_REGISTRY.some(l => l.id === paramLeague));

  useEffect(() => {
    if (isValidParam) {
      setLeagueFilter(paramLeague as LeagueId | 'all');
    } else if (activeLeague) {
      setLeagueFilter(activeLeague);
    }
  }, [activeLeague, paramLeague, isValidParam]);

  const statsQuery = useQuery({
    queryKey: ['stats', leagueFilter],
    queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
    enabled: isSignedIn,
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

  // Stable select callback — prevents StatsTableRow from re-rendering when
  // an unrelated state change fires in the parent
  const handleSelectPlayer = useCallback((id: string) => {
    setSelectedPlayer(id);
  }, []);

  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;

  const maxStat = useCallback(
    (key: StatKey) => Math.max(...filtered.map(p => p.stats[key])),
    [filtered],
  );

  const activeLeagueObj = leagueFilter !== 'all' ? LEAGUE_REGISTRY.find(l => l.id === leagueFilter) : null;

  // Stable itemData for react-window
  const virtualRowData = useMemo<VirtualRowData>(
    () => ({ players: visibleRows, sortBy, selectedPlayer, onSelect: handleSelectPlayer }),
    [visibleRows, sortBy, selectedPlayer, handleSelectPlayer],
  );

  const listHeight = Math.min(visibleRows.length * ROW_HEIGHT, MAX_LIST_HEIGHT);
  const shouldVirtualize = visibleRows.length > VIRTUALIZE_THRESHOLD;

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

        {/* Filters */}
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
                <img
                  src={l.logo}
                  alt=""
                  width={14}
                  height={14}
                  className="flex-shrink-0 opacity-80"
                  style={{ aspectRatio: '1/1' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {l.shortName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Table */}
          <div className="lg:col-span-2">
            <div className="panel overflow-hidden">
              {/* Table header — always rendered */}
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
                  {/* Render table body only when NOT virtualizing */}
                  {!shouldVirtualize && (
                    <tbody>
                      {visibleRows.map(p => (
                        <StatsTableRow
                          key={p.id}
                          player={p}
                          sortBy={sortBy}
                          isSelected={selectedPlayer === p.id}
                          onSelect={handleSelectPlayer}
                        />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>

              {/* Virtualized list — used only when >VIRTUALIZE_THRESHOLD rows */}
              {shouldVirtualize && (
                <div style={{ height: listHeight }}>
                  <List
                    rowCount={visibleRows.length}
                    rowHeight={ROW_HEIGHT}
                    rowComponent={VirtualStatsRow}
                    rowProps={virtualRowData}
                  />
                </div>
              )}

              {!hasPremiumPlayerAccess && (
                <div className="p-4 border-t border-border bg-secondary/40 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    Showing minimal stats preview. Players with an active $7 registration tier get full sortable stats and player detail access.
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                    <Lock className="w-3 h-3" /> Premium Player Stats
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Player Detail Panel */}
          <div>
            {detail && hasPremiumPlayerAccess ? (
              <div className="panel p-4 sticky top-24 space-y-4">
                <div className="flex items-center gap-3">
                  <PlayerAvatar src={detail.avatar} alt={detail.name} className="w-16 h-16" />
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
                          <circle
                            cx="32" cy="32" r="28" fill="none"
                            stroke="hsl(var(--primary))" strokeWidth="3"
                            strokeDasharray={circumference} strokeDashoffset={dashOffset}
                            strokeLinecap="round" transform="rotate(-90 32 32)"
                            className="transition-all duration-500"
                          />
                          <text
                            x="32" y="32" textAnchor="middle" dominantBaseline="central"
                            fill="hsl(var(--foreground))" fontSize="14" fontWeight="700"
                            fontFamily="Space Grotesk, monospace"
                          >
                            {val}
                          </text>
                        </svg>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                          {statLabels[k]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="panel p-8 text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {hasPremiumPlayerAccess
                    ? 'Select a player to view stat breakdown'
                    : 'Upgrade to active player tier to unlock full stat breakdowns and all player profiles.'}
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
