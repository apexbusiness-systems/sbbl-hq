import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  fetchReactionAggregate,
  type ReactionAggregate,
  type ReactionKind,
} from '@/lib/api/reactions';

type Props = {
  gameId: string;
  variant?: 'inline' | 'overlay';
  className?: string;
};

type Counts = Record<ReactionKind, number>;

const REACTION_KINDS: ReactionKind[] = ['fire', 'heart', 'clap'];

const ZERO_COUNTS: Counts = { fire: 0, heart: 0, clap: 0 };

const REACTION_META: Record<ReactionKind, { emoji: string; label: string }> = {
  fire: { emoji: '🔥', label: 'Fire' },
  heart: { emoji: '❤️', label: 'Heart' },
  clap: { emoji: '👏', label: 'Clap' },
};

const GOLD = '#ffb020';

function isReactionKind(value: string): value is ReactionKind {
  return value === 'fire' || value === 'heart' || value === 'clap';
}

function aggregatesToCounts(aggregates: ReactionAggregate[] | undefined): Counts {
  const next: Counts = { ...ZERO_COUNTS };
  if (!Array.isArray(aggregates)) return next;
  for (const entry of aggregates) {
    if (!entry || !isReactionKind(entry.reaction_type)) continue;
    const value = Number(entry.count);
    next[entry.reaction_type] = Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return next;
}

export function CheerMeter({ gameId, variant = 'inline', className }: Props) {
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const baselineRef = useRef<Counts>({ ...ZERO_COUNTS });

  // Seed + periodic correction fetch.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchReactionAggregate(gameId, 30);
        if (cancelled) return;
        const next = res.ok ? aggregatesToCounts(res.data) : { ...ZERO_COUNTS };
        baselineRef.current = { ...next };
        setCounts(next);
      } catch {
        // Explicit empty-state on failure: never fall back to fixtures.
        if (cancelled) return;
        baselineRef.current = { ...ZERO_COUNTS };
        setCounts({ ...ZERO_COUNTS });
      }
    };

    void load();
    const correction = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(correction);
    };
  }, [gameId]);

  // Realtime INSERT subscription — bumps per reaction.
  useEffect(() => {
    if (!gameId) return;
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`cheermeter-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_reactions',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const type = (payload.new as { reaction_type: string }).reaction_type;
          if (isReactionKind(type)) {
            setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [gameId]);

  // Decay every 2s toward the seeded baseline so live bursts relax over time.
  useEffect(() => {
    if (!gameId) return;
    const decay = window.setInterval(() => {
      setCounts((prev) => {
        const next: Counts = { ...prev };
        let changed = false;
        for (const kind of REACTION_KINDS) {
          const base = baselineRef.current[kind];
          const current = prev[kind];
          if (current > base) {
            // Move halfway back toward baseline, floor at baseline.
            const decayed = Math.max(base, Math.floor((current + base) / 2));
            if (decayed !== current) {
              next[kind] = decayed;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }, 2_000);

    return () => {
      window.clearInterval(decay);
    };
  }, [gameId]);

  const totalMax = useMemo(() => {
    return Math.max(counts.fire, counts.heart, counts.clap);
  }, [counts]);

  if (!gameId) return null;

  const isOverlay = variant === 'overlay';

  const rootClassName = isOverlay
    ? `flex flex-col gap-2 p-3 text-white ${className ?? ''}`.trim()
    : `panel p-3 flex flex-col gap-2 ${className ?? ''}`.trim();

  const rootStyle: React.CSSProperties | undefined = isOverlay
    ? {
        background: 'rgba(10,12,18,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        maxWidth: 220,
        borderRadius: 8,
      }
    : undefined;

  const captionClass = isOverlay
    ? 'text-[10px] uppercase tracking-[0.18em]'
    : 'text-[10px] uppercase tracking-[0.18em] text-muted-foreground';
  const captionStyle: React.CSSProperties | undefined = isOverlay
    ? { color: GOLD }
    : undefined;

  const labelClass = isOverlay
    ? 'text-[11px] font-medium text-white/90'
    : 'text-[11px] font-medium text-foreground';

  const countClass = isOverlay
    ? 'text-[11px] tabular-nums text-white/70'
    : 'text-[11px] tabular-nums text-muted-foreground';

  const trackClass = isOverlay
    ? 'relative h-2 w-full overflow-hidden'
    : 'relative h-2 w-full overflow-hidden bg-muted';
  const trackStyle: React.CSSProperties = isOverlay
    ? { background: 'rgba(255,255,255,0.12)', borderRadius: 4 }
    : { borderRadius: 4 };

  return (
    <div className={rootClassName} style={rootStyle} aria-label="Live reactions">
      <div className="flex items-center justify-between">
        <span className={labelClass} style={isOverlay ? { color: GOLD } : undefined}>
          Cheer Meter
        </span>
        <span className={captionClass} style={captionStyle}>
          Last 30 s
        </span>
      </div>

      {REACTION_KINDS.map((kind) => {
        const count = counts[kind];
        const denom = Math.max(totalMax, 10);
        const pct = Math.min(100, (count / denom) * 100);
        const fillStyle: React.CSSProperties = isOverlay
          ? {
              width: `${pct}%`,
              background: GOLD,
              borderRadius: 4,
            }
          : {
              width: `${pct}%`,
              borderRadius: 4,
            };
        const fillClass = isOverlay
          ? 'absolute inset-y-0 left-0 transition-[width] duration-500 ease-out'
          : 'absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 ease-out';

        return (
          <div key={kind} className="flex items-center gap-2">
            <span
              className="w-5 text-center text-sm leading-none"
              aria-hidden="true"
            >
              {REACTION_META[kind].emoji}
            </span>
            <div className="flex-1">
              <div className={trackClass} style={trackStyle}>
                <div
                  className={fillClass}
                  style={fillStyle}
                  role="progressbar"
                  aria-label={`${REACTION_META[kind].label} reactions`}
                  aria-valuenow={count}
                  aria-valuemin={0}
                />
              </div>
            </div>
            <span className={countClass}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default CheerMeter;
