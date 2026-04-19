/**
 * MicUpIntroSting — 2.5s intro animation played once per session per
 * game. Black frame → gold particle burst → wordmark slam → names
 * vs-card → fade-to-video.
 *
 * CSS-only (no framer-motion). Uses `sessionStorage` to enforce
 * once-per-session-per-game so returning viewers don't watch it again.
 * Honors prefers-reduced-motion — falls through immediately.
 */
import { memo, useEffect, useState } from 'react';
import { MicUpSeriesBadge } from './MicUpSeriesBadge';

interface Props {
  gameId: string;
  leftPlayerLabel: string;
  rightPlayerLabel: string;
  /** Called after the sting finishes (or skips for reduced-motion). */
  onComplete?: () => void;
  /** Test hook — skip the sessionStorage gate. */
  forcePlay?: boolean;
}

const STORAGE_PREFIX = 'sbbl-micup-intro:';
const DURATION_MS = 2500;

function hasPlayed(gameId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + gameId) === '1';
  } catch {
    return false;
  }
}

function markPlayed(gameId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + gameId, '1');
  } catch {
    /* private mode / quota — ignore */
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function MicUpIntroStingImpl({
  gameId,
  leftPlayerLabel,
  rightPlayerLabel,
  onComplete,
  forcePlay = false,
}: Props) {
  const [visible, setVisible] = useState(() => {
    if (forcePlay) return true;
    if (prefersReducedMotion()) return false;
    return !hasPlayed(gameId);
  });

  useEffect(() => {
    if (!visible) {
      onComplete?.();
      return;
    }
    markPlayed(gameId);
    const t = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, DURATION_MS);
    return () => window.clearTimeout(t);
  }, [visible, gameId, onComplete]);

  if (!visible) return null;

  return (
    <div
      data-testid="mic-up-intro-sting"
      aria-hidden
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ backgroundColor: 'hsl(var(--background))' }}
    >
      {/* Stage 1 (0 - 400ms): Gold particle burst from center */}
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const dist = 180;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          return (
            <span
              key={i}
              className="absolute w-2 h-2 rounded-full opacity-0"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                animation: `sbbl-micup-particle 400ms cubic-bezier(0.34, 1.2, 0.64, 1) ${i * 6}ms forwards`,
                ['--dx' as string]: `${dx}px`,
                ['--dy' as string]: `${dy}px`,
              }}
            />
          );
        })}
      </div>

      {/* Stage 2 (400 - 1200ms): Wordmark slam */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0"
        style={{
          animation: 'sbbl-micup-slam 800ms cubic-bezier(0.34, 1.56, 0.64, 1) 400ms forwards',
        }}
      >
        <MicUpSeriesBadge variant="wordmark" size="lg" />
      </div>

      {/* Stage 3 (1200 - 2000ms): Player names with VS */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0"
        style={{
          animation: 'sbbl-micup-names 800ms cubic-bezier(0.16, 1, 0.3, 1) 1200ms forwards',
        }}
      >
        <div className="flex items-center gap-6 mt-32">
          <span
            className="font-display uppercase text-4xl md:text-5xl tracking-wider text-foreground opacity-0"
            style={{ animation: 'sbbl-micup-name-left 600ms ease-out 1200ms forwards' }}
          >
            {leftPlayerLabel}
          </span>
          <span
            className="font-display uppercase text-5xl md:text-6xl tracking-widest font-bold"
            style={{ color: 'hsl(var(--destructive))' }}
          >
            VS
          </span>
          <span
            className="font-display uppercase text-4xl md:text-5xl tracking-wider text-foreground opacity-0"
            style={{ animation: 'sbbl-micup-name-right 600ms ease-out 1200ms forwards' }}
          >
            {rightPlayerLabel}
          </span>
        </div>
      </div>

      {/* Stage 4 (2000 - 2500ms): Crush to center + fade */}
      <div
        className="absolute inset-0 bg-background"
        style={{ animation: 'sbbl-micup-crush 500ms ease-in 2000ms forwards', opacity: 0 }}
      />

      <style>{`
        @keyframes sbbl-micup-particle {
          0%   { opacity: 1; transform: translate3d(0,0,0) scale(0.3); }
          60%  { opacity: 1; transform: translate3d(calc(var(--dx) * 0.9), calc(var(--dy) * 0.9), 0) scale(1.1); }
          100% { opacity: 0; transform: translate3d(var(--dx), var(--dy), 0) scale(0.4); }
        }
        @keyframes sbbl-micup-slam {
          0%   { opacity: 0; transform: translateY(-200px) scale(2); }
          30%  { opacity: 1; transform: translateY(0) scale(1); }
          35%  { transform: translateY(-4px) scale(1); }   /* impact freeze */
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sbbl-micup-names {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes sbbl-micup-name-left {
          0%   { opacity: 0; transform: translateX(-80px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes sbbl-micup-name-right {
          0%   { opacity: 0; transform: translateX(80px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes sbbl-micup-crush {
          0%   { opacity: 0; transform: scale(1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export const MicUpIntroSting = memo(MicUpIntroStingImpl);
