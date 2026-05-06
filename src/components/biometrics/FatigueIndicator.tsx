/**
 * Fatigue label — 4 discrete states with semantic colour + shake at gassed.
 */
import { memo } from 'react';
import type { FatigueLevel } from '@/lib/biometrics/types';

interface Props {
  level: FatigueLevel | null;
  className?: string;
}

const META: Record<FatigueLevel, { label: string; color: string }> = {
  fresh:    { label: 'FRESH',    color: 'hsl(var(--success))' },
  moderate: { label: 'MODERATE', color: 'hsl(var(--primary))' },
  tired:    { label: 'TIRED',    color: 'hsl(var(--warning))' },
  gassed:   { label: 'GASSED',   color: 'hsl(var(--destructive))' },
};

function FatigueIndicatorImpl({ level, className = '' }: Props) {
  if (!level) {
    return (
      <span
        data-testid="fatigue-indicator"
        data-level="unknown"
        className={`font-display tracking-wider text-[10px] uppercase text-muted-foreground ${className}`}
      >
        —
      </span>
    );
  }
  const meta = META[level];
  const shake = level === 'gassed';
  return (
    <>
      <span
        data-testid="fatigue-indicator"
        data-level={level}
        className={[
          'font-display tracking-wider text-[11px] uppercase font-semibold',
          shake ? 'animate-[sbbl-fatigue-shake_150ms_ease-in-out_3]' : '',
          'motion-reduce:animate-none',
          className,
        ].join(' ')}
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
      <style>{`
        @keyframes sbbl-fatigue-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25%      { transform: translateX(-2px) rotate(-1deg); }
          75%      { transform: translateX(2px)  rotate(1deg); }
        }
      `}</style>
    </>
  );
}

export const FatigueIndicator = memo(FatigueIndicatorImpl);
