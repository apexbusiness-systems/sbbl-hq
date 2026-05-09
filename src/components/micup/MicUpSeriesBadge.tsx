/**
 * Inline Mic Up Series wordmark — small badge for /live header, replay
 * cards, and anywhere a brand mark is needed.
 *
 * Uses the public SVG asset by default but also supports a compact
 * text-only variant for dense layouts.
 */
import { memo } from 'react';

interface Props {
  variant?: 'wordmark' | 'mark' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const WIDTHS = { sm: 100, md: 160, lg: 240 } as const;

function MicUpSeriesBadgeImpl({ variant = 'wordmark', size = 'md', className = '' }: Props) {
  if (variant === 'compact') {
    return (
      <span
        data-testid="mic-up-badge-compact"
        className={[
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm',
          'bg-[hsl(var(--primary)/0.15)] text-primary',
          'border border-[hsl(var(--primary)/0.3)]',
          'font-display uppercase tracking-wider text-[9px] font-bold',
          className,
        ].join(' ')}
      >
        🎤 Mic Up Series
      </span>
    );
  }
  const asset = variant === 'mark' ? '/assets/micup/mic-up-mark.svg' : '/assets/micup/mic-up-wordmark.svg';
  const width = variant === 'mark' ? 32 : WIDTHS[size];
  return (
    <img
      data-testid={`mic-up-badge-${variant}`}
      src={asset}
      alt="Mic Up Series"
      width={width}
      height={variant === 'mark' ? 32 : width / 5}
      className={`inline-block ${className}`}
      decoding="async"
    />
  );
}

export const MicUpSeriesBadge = memo(MicUpSeriesBadgeImpl);
