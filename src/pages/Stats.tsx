import { useState, useMemo } from 'react';
import { players, teams, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LeagueId, StatLine } from '@/types';
import { ArrowUpDown, BarChart3 } from 'lucide-react';

type StatKey = keyof StatLine;
const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'fls', 'min'];
const statLabels: Record<StatKey, string> = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fls: 'FLS', min: 'MIN' };

const StatsPage = () => {
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | 'all'>('all');
  const [sortBy, setSortBy] = useState<StatKey>('pts');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = leagueFilter === 'all' ? players : players.filter(p => p.leagueId === leagueFilter);
    return [...list].sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
  }, [leagueFilter, sortBy]);

  const detail = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null;

  const maxStat = (key: StatKey) => Math.max(...filtered.map(p => p.stats[key]));

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Stats</h1>
            <p className="text-sm text-muted-foreground mt-1">Player statistics across all leagues</p>
          </div>
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex gap-1 p-1 bg-secondary rounded-sm">
            {(['all', 'sbbl', 'wbl', 'tgifbl'] as const).map(l => (
              <button key={l} onClick={() => setLeagueFilter(l)} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors ${leagueFilter === l ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
                {l === 'all' ? 'All' : l.toUpperCase()}
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
                    {filtered.map((p, i) => (
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
                <p className="text-sm text-muted-foreground">Select a player to view stat breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
