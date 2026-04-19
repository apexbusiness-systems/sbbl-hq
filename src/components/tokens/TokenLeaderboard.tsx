/**
 * Token leaderboard — real-time subjective ranking for a game or season.
 *
 * Visual: ranked list with rank indicator (custom SVG for top 3), player
 * name, and total-tokens count. Animates position swap on realtime
 * update via CSS transition (transform).
 */
import { memo, useEffect, useRef } from 'react';
import type { LeaderboardEntry } from '@/lib/tokens/types';
import { TokenCoinIcon } from './TokenCoinIcon';

interface Props {
  entries: LeaderboardEntry[];
  emptyLabel?: string;
  /** Max rows rendered (default 25). */
  limit?: number;
  onPlayerClick?: (playerId: string) => void;
}

const RANK_FILL = [
  'hsl(var(--primary))',                // gold
  'hsl(210 10% 75%)',                   // silver
  'hsl(30 50% 45%)',                    // bronze
];

function RankMedal({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="font-display text-muted-foreground text-sm w-6 text-center tabular-nums">
        {rank}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" fill={RANK_FILL[rank - 1]} />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="10"
        fontWeight="700"
        fill="hsl(var(--primary-foreground))"
      >
        {rank}
      </text>
    </svg>
  );
}

function TokenLeaderboardImpl({
  entries,
  emptyLabel = 'No awards yet — be the first.',
  limit = 25,
  onPlayerClick,
}: Props) {
  const rows = entries.slice(0, limit);
  const lastIdsRef = useRef<string[]>([]);

  useEffect(() => {
    lastIdsRef.current = rows.map((r) => r.playerId);
  });

  if (rows.length === 0) {
    return (
      <div
        data-testid="token-leaderboard-empty"
        className="p-4 rounded-md border border-border bg-card text-sm text-muted-foreground"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <ol
      data-testid="token-leaderboard"
      className="flex flex-col gap-1 rounded-md border border-border bg-card overflow-hidden"
    >
      {rows.map((entry, idx) => {
        const rank = idx + 1;
        return (
          <li
            key={entry.playerId}
            data-testid={`token-leaderboard-row-${entry.playerId}`}
            className={[
              'flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0',
              'transition-[background-color,transform] duration-300',
              'hover:bg-[hsl(var(--primary)/0.04)]',
            ].join(' ')}
          >
            <RankMedal rank={rank} />
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onPlayerClick?.(entry.playerId)}
                className={[
                  'text-left text-sm font-semibold text-foreground truncate max-w-full',
                  'hover:underline underline-offset-2 decoration-primary/60',
                ].join(' ')}
              >
                {entry.player?.displayName ?? entry.playerId}
              </button>
            </div>
            <div className="flex items-center gap-1 font-display text-base text-primary tabular-nums">
              <TokenCoinIcon size={14} />
              {entry.totalTokens.toLocaleString()}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export const TokenLeaderboard = memo(TokenLeaderboardImpl);
