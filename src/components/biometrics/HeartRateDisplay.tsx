/**
 * Heart-rate readout — basketball-shaped SVG that beats in sync with BPM.
 *
 * Beat interval = 60000 / bpm ms. Above 180 BPM the icon switches to
 * the destructive token (red). On prefers-reduced-motion the beat halts.
 */
import { memo, useMemo } from 'react';
import { isHeartRateDanger } from '@/lib/biometrics/types';

interface Props {
  bpm: number | null;
  size?: number;
  className?: string;
}

function HeartRateDisplayImpl({ bpm, size = 20, className = '' }: Props) {
  const intervalMs = useMemo(() => {
    if (!bpm || bpm <= 0) return 0;
    return Math.max(300, Math.min(2000, Math.round(60_000 / bpm)));
  }, [bpm]);

  const danger = isHeartRateDanger(bpm);
  const color = danger ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))';

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      data-testid="heart-rate-display"
      data-danger={danger ? 'true' : 'false'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        className="motion-reduce:[animation:none_!important]"
        style={
          intervalMs > 0
            ? { animation: `sbbl-hr-beat ${intervalMs}ms ease-in-out infinite` }
            : undefined
        }
      >
        <circle cx="12" cy="12" r="10" fill={color} />
        <g stroke="hsl(var(--background))" strokeWidth="1" strokeLinecap="round" fill="none">
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M 4 8 Q 12 12 20 8" />
          <path d="M 4 16 Q 12 12 20 16" />
        </g>
      </svg>
      <span
        className="font-display text-[22px] leading-none tabular-nums"
        style={{ color }}
      >
        {bpm != null ? bpm : '—'}
        <span className="text-[10px] font-normal text-muted-foreground ml-1">BPM</span>
      </span>
      <style>{`
        @keyframes sbbl-hr-beat {
          0%, 100% { transform: scale(1); }
          20%      { transform: scale(1.15); }
          40%      { transform: scale(1); }
          60%      { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

export const HeartRateDisplay = memo(HeartRateDisplayImpl);
