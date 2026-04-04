// ScoreCard — memoized game score card used in Scores page grid.
// Extracted as a standalone component so React.memo can prevent re-renders
// when the parent page re-renders due to filter state changes unrelated to
// this card's entry data.

import { memo } from 'react';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import type { ScoreEntry } from '@/types';
import { Users, Star, Calendar } from 'lucide-react';

// Pure helpers — defined at module scope so they are never re-created
export function statusLabel(status: string): string {
  if (status === 'live') return 'Live';
  if (status === 'final') return 'Final';
  if (status === 'upcoming' || status === 'scheduled') return 'Upcoming';
  if (status === 'postponed') return 'Postponed';
  return status;
}

export function statusColor(status: string): string {
  if (status === 'live') return 'text-red-400 bg-red-500/15';
  if (status === 'final') return 'text-green-400 bg-green-500/10';
  if (status === 'postponed') return 'text-yellow-400 bg-yellow-500/10';
  return 'text-muted-foreground bg-secondary';
}

export function winnerSide(entry: ScoreEntry): 'home' | 'away' | null {
  if (entry.status !== 'final') return null;
  if (entry.homeScore == null || entry.awayScore == null) return null;
  if (entry.homeScore > entry.awayScore) return 'home';
  if (entry.awayScore > entry.homeScore) return 'away';
  return null;
}

export const ScoreCard = memo(function ScoreCard({ entry }: { entry: ScoreEntry }) {
  const winner = winnerSide(entry);
  const hasScore = entry.homeScore != null && entry.awayScore != null;
  const leagueId = entry.leagueId;

  return (
    <div className="panel p-0 overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {entry.category === 'league' && leagueId && (
            <LeagueBadge leagueId={leagueId} size="sm" />
          )}
          {entry.category === '1v1' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-purple-500/15 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
              <Users className="w-2.5 h-2.5" /> 1v1
            </span>
          )}
          {entry.category === 'special_event' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <Star className="w-2.5 h-2.5" /> Event
            </span>
          )}
          {entry.eventName && (
            <span className="text-[10px] text-muted-foreground truncate">{entry.eventName}</span>
          )}
          {!entry.eventName && entry.seasonName && (
            <span className="text-[10px] text-muted-foreground truncate">{entry.seasonName}</span>
          )}
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${statusColor(entry.status)}`}>
          {statusLabel(entry.status)}
          {entry.status === 'live' && (
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse align-middle" />
          )}
        </span>
      </div>

      {/* Score body */}
      <div className="px-4 py-3 flex-1 space-y-2">
        {/* Away row */}
        <div className="flex items-center justify-between gap-2">
          <span className={`font-display font-bold text-sm truncate ${winner === 'away' ? 'text-foreground' : winner === 'home' ? 'text-muted-foreground' : ''}`}>
            {entry.awayLabel}
          </span>
          <span className={`stat-numeral text-xl flex-shrink-0 w-8 text-right ${!hasScore ? 'text-muted-foreground/40' : winner === 'away' ? 'text-foreground' : 'text-muted-foreground'}`}>
            {hasScore ? entry.awayScore : '—'}
          </span>
        </div>
        {/* Home row */}
        <div className="flex items-center justify-between gap-2">
          <span className={`font-display font-bold text-sm truncate ${winner === 'home' ? 'text-foreground' : winner === 'away' ? 'text-muted-foreground' : ''}`}>
            {entry.homeLabel}
          </span>
          <span className={`stat-numeral text-xl flex-shrink-0 w-8 text-right ${!hasScore ? 'text-muted-foreground/40' : winner === 'home' ? 'text-foreground' : 'text-muted-foreground'}`}>
            {hasScore ? entry.homeScore : '—'}
          </span>
        </div>
      </div>

      {/* Card footer */}
      {(entry.gameDate || entry.notes) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-2">
          {entry.gameDate && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {new Date(entry.gameDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {entry.notes && (
            <span className="text-[10px] text-muted-foreground/70 italic truncate w-full">{entry.notes}</span>
          )}
        </div>
      )}
    </div>
  );
});
