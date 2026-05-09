/**
 * Event metadata card — shown at the top of the preflight panel.
 *
 * Surface-level only: name, state badge, tipoff countdown, PPV price.
 * Pure presentation; parent owns all state and click handlers.
 */
import type { GameStreamState } from '@/lib/preflight/types';

interface Props {
  title: string;
  state: GameStreamState;
  tipoffAt?: string | null;
  ppvPriceCad?: number | null;
}

const STATE_LABEL: Record<GameStreamState, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  halftime: 'Halftime',
  ended_replay: 'Replay Available',
  ended_no_replay: 'Ended',
  unavailable: 'Unavailable',
};

const STATE_CLASS: Record<GameStreamState, string> = {
  upcoming: 'bg-[hsl(var(--primary)/0.15)] text-primary border-[hsl(var(--primary)/0.3)]',
  live: 'bg-[hsl(var(--live)/0.15)] text-[hsl(var(--live))] border-[hsl(var(--live)/0.3)]',
  halftime: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]',
  ended_replay: 'bg-card/60 text-muted-foreground border-border',
  ended_no_replay: 'bg-card/60 text-muted-foreground border-border',
  unavailable: 'bg-destructive/15 text-destructive border-destructive/30',
};

function formatCountdown(tipoffAt: string | null | undefined, now = Date.now()): string | null {
  if (!tipoffAt) return null;
  const diff = new Date(tipoffAt).getTime() - now;
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 0) return `${hrs}h ${mins}m to tipoff`;
  return `${mins}m to tipoff`;
}

export function PreflightEventCard({ title, state, tipoffAt, ppvPriceCad }: Props) {
  const countdown = formatCountdown(tipoffAt);
  return (
    <div
      data-testid="preflight-event-card"
      className="p-4 rounded-md border border-border bg-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display uppercase tracking-wide text-base text-foreground leading-tight">
          {title}
        </h3>
        <span
          data-testid="preflight-event-state"
          className={`shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider border ${STATE_CLASS[state]}`}
        >
          {STATE_LABEL[state]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {countdown && <span>{countdown}</span>}
        {ppvPriceCad != null && (
          <span>
            PPV <span className="text-foreground font-semibold">${ppvPriceCad.toFixed(2)} CAD</span>
          </span>
        )}
      </div>
    </div>
  );
}
