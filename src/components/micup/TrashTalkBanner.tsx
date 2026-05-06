/**
 * Trash talk banner — full-width centered alert, 3s auto-dismiss,
 * wiggle animation, destructive-token background.
 */
import { memo, useEffect, useState } from 'react';

interface Props {
  label?: string;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

function TrashTalkBannerImpl({
  label = 'TRASH TALK DETECTED',
  autoDismissMs = 3000,
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
      data-testid="trash-talk-banner"
      role="alert"
      className={[
        'absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none',
        'flex items-center justify-center',
      ].join(' ')}
    >
      <div
        className={[
          'px-6 py-3 rounded-md text-center',
          'bg-gradient-to-r from-destructive via-[hsl(var(--destructive)/0.85)] to-destructive',
          'font-display uppercase tracking-widest font-bold text-[26px] md:text-[32px]',
          'text-[hsl(var(--destructive-foreground))]',
          'shadow-2xl',
          'animate-[sbbl-trashtalk-wiggle_100ms_ease-in-out_4]',
          'motion-reduce:animate-none',
        ].join(' ')}
      >
        🎤 {label}
      </div>
      <style>{`
        @keyframes sbbl-trashtalk-wiggle {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(-3deg); }
          75%      { transform: rotate(3deg); }
        }
      `}</style>
    </div>
  );
}

export const TrashTalkBanner = memo(TrashTalkBannerImpl);
