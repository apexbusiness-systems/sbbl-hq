/**
 * Segmented stamina bar — custom SVG, 10 segments, right-to-left drain.
 *
 * Colours:
 *   100–70% → --success
 *   69–40%  → --primary (gold = caution)
 *   39–0%   → --destructive (+ pulse glow under 30%)
 */
import { memo } from 'react';
import { zoneForStamina } from '@/lib/biometrics/types';

interface Props {
  pct: number | null;
  widthPx?: number;
  heightPx?: number;
  className?: string;
}

const SEGMENTS = 10;
const GAP = 2;

function StaminaBarImpl({ pct, widthPx = 160, heightPx = 12, className = '' }: Props) {
  const safe = typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : 0;
  const filled = Math.round((safe / 100) * SEGMENTS);
  const zone = zoneForStamina(pct);
  const fill =
    zone === 'green' ? 'hsl(var(--success))'
    : zone === 'gold' ? 'hsl(var(--primary))'
    : 'hsl(var(--destructive))';
  const segW = (widthPx - GAP * (SEGMENTS - 1)) / SEGMENTS;
  const pulse = zone === 'red' && safe < 30;

  return (
    <div
      data-testid="stamina-bar"
      data-zone={zone}
      className={`inline-block relative ${pulse ? 'animate-[sbbl-stamina-pulse_600ms_ease-in-out_infinite]' : ''} ${className}`}
      style={{ width: widthPx, height: heightPx }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      aria-label={`Stamina ${Math.round(safe)} percent`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        aria-hidden
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          // Right-to-left drain: segments fill from the LEFT (index 0),
          // so the last-filled is at position `filled - 1`. The DRAIN
          // effect is that as pct falls, index (filled-1) down to 0
          // stay; higher indexes empty. Visually, emptying segments are
          // on the right — matching the "drain" metaphor.
          const isOn = i < filled;
          const x = i * (segW + GAP);
          return (
            <rect
              key={i}
              x={x}
              y={0}
              width={segW}
              height={heightPx}
              rx={1}
              fill={isOn ? fill : 'hsl(var(--muted))'}
              style={{ transition: 'fill 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          );
        })}
      </svg>
      <style>{`
        @keyframes sbbl-stamina-pulse {
          0%, 100% { filter: drop-shadow(0 0 0 hsl(var(--destructive) / 0)); }
          50%      { filter: drop-shadow(0 0 6px hsl(var(--destructive) / 0.45)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="stamina-bar"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export const StaminaBar = memo(StaminaBarImpl);
