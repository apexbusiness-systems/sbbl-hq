/**
 * Token coin — custom SVG, basketball-gold treatment.
 *
 * Designed to stay crisp at 16 / 24 / 32 / 48 px. No icon-library
 * dependency. Uses the existing Tailwind primary token (gold) so any
 * brand shift propagates without touching this file.
 */
import { memo } from 'react';

interface Props {
  size?: number;
  className?: string;
  title?: string;
}

function TokenCoinIconImpl({ size = 20, className = '', title = 'Fan token' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {/* Outer coin ring */}
      <circle cx="12" cy="12" r="11" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="1" />
      {/* Inner highlight */}
      <circle cx="12" cy="12" r="9" fill="hsl(var(--primary))" />
      {/* Basketball seams etched into the coin */}
      <g stroke="hsl(var(--primary-foreground))" strokeWidth="0.9" strokeLinecap="round" fill="none">
        <line x1="12" y1="3.5" x2="12" y2="20.5" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <path d="M 4.5 8 Q 12 12 19.5 8" />
        <path d="M 4.5 16 Q 12 12 19.5 16" />
      </g>
    </svg>
  );
}

export const TokenCoinIcon = memo(TokenCoinIconImpl);
