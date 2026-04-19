/**
 * Lower-third overlay — 4s auto-dismiss, slide-in from left.
 */
import { memo, useEffect, useState } from 'react';

interface Props {
  playerName: string;
  teamName?: string;
  statLine?: string;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

function MicUpLowerThirdImpl({
  playerName,
  teamName,
  statLine,
  autoDismissMs = 4000,
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      data-testid="mic-up-lower-third"
      className={[
        'absolute left-6 bottom-12 z-10',
        'px-4 py-2.5 min-w-[280px] max-w-[50%]',
        'bg-[hsl(var(--background)/0.8)] backdrop-blur-md',
        'border-l-4 border-primary',
        'animate-[sbbl-l3-in_300ms_cubic-bezier(0.16,1,0.3,1)_forwards]',
      ].join(' ')}
    >
      <div className="font-display uppercase tracking-wide text-[22px] text-foreground leading-tight">
        {playerName}
      </div>
      {teamName && (
        <div className="text-[12px] text-muted-foreground mt-0.5">{teamName}</div>
      )}
      {statLine && (
        <div className="text-[12px] text-foreground/80 mt-1 tabular-nums">{statLine}</div>
      )}
      <style>{`
        @keyframes sbbl-l3-in {
          0%   { opacity: 0; transform: translateX(-24px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export const MicUpLowerThird = memo(MicUpLowerThirdImpl);
