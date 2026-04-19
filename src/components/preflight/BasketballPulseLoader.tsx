/**
 * Basketball pulse loader — custom SVG, pure CSS animation.
 *
 * Used in place of a generic spinner during preflight. Deliberate design
 * choices:
 *   - Inline SVG, no icon library, no framer-motion dependency.
 *   - Animation uses the existing Tailwind token system (bg/primary/foreground)
 *     so brand changes propagate without touching this file.
 *   - Respects `prefers-reduced-motion`: pulse halts, ball remains static.
 */
import { memo } from 'react';

interface Props {
  /** Pixel size of the rendered square. Default 48. */
  size?: number;
  /** ARIA label for screen readers. */
  label?: string;
  className?: string;
}

function BasketballPulseLoaderImpl({
  size = 48,
  label = 'Running preflight checks',
  className = '',
}: Props) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width={size}
        height={size}
        aria-hidden
        className="animate-[sbbl-basketball-pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
      >
        <title>{label}</title>
        {/* Subtle pulse ring — gold at 15% opacity, fades out */}
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="hsl(var(--primary) / 0.15)"
          className="origin-center animate-[sbbl-basketball-ring_1.4s_ease-out_infinite] motion-reduce:animate-none"
        />
        {/* Ball body */}
        <circle cx="24" cy="24" r="14" fill="hsl(var(--primary))" />
        {/* Basketball seams — a single path with four arcs. Using stroke
            over fill so line thickness stays crisp at small sizes. */}
        <g
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        >
          <line x1="24" y1="10" x2="24" y2="38" />
          <line x1="10" y1="24" x2="38" y2="24" />
          <path d="M 11 16 Q 24 24 37 16" />
          <path d="M 11 32 Q 24 24 37 32" />
        </g>
      </svg>
      <style>{`
        @keyframes sbbl-basketball-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes sbbl-basketball-ring {
          0%   { transform: scale(0.85); opacity: 0.5; }
          80%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export const BasketballPulseLoader = memo(BasketballPulseLoaderImpl);
