/**
 * Token award animation — coin burst on successful award.
 *
 * Renders an absolutely-positioned layer with 10 coin SVGs that fly out
 * from the source button on a physics-shaped trajectory. CSS-only
 * animation using per-particle custom properties, no library. The
 * component mounts on demand from the parent; the parent unmounts it
 * after `durationMs` to clean up.
 */
import { memo, useMemo } from 'react';
import { TokenCoinIcon } from './TokenCoinIcon';

interface Props {
  origin: { x: number; y: number };
  /** Particles emitted. Default 10; cap at 24 to protect paint cost. */
  count?: number;
  durationMs?: number;
}

function TokenAwardAnimationImpl({ origin, count = 10, durationMs = 600 }: Props) {
  const particles = useMemo(() => {
    const safeCount = Math.min(24, Math.max(1, count));
    return Array.from({ length: safeCount }, (_, i) => {
      const angle = (i / safeCount) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 60 + Math.random() * 40;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 30; // initial upward bias
      const rot = Math.floor(Math.random() * 360);
      const delay = Math.random() * 80;
      return { i, dx, dy, rot, delay };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      data-testid="token-award-animation"
      className="pointer-events-none fixed z-40"
      style={{ left: origin.x, top: origin.y }}
    >
      {particles.map((p) => (
        <span
          key={p.i}
          className="absolute -translate-x-1/2 -translate-y-1/2 opacity-0"
          style={{
            animation: `sbbl-token-burst ${durationMs}ms cubic-bezier(0.34, 1.2, 0.64, 1) ${p.delay}ms forwards`,
            // Per-particle CSS custom props consumed by the keyframe:
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        >
          <TokenCoinIcon size={20} />
        </span>
      ))}
      <style>{`
        @keyframes sbbl-token-burst {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(0.4);
          }
          60% {
            opacity: 1;
            transform:
              translate3d(calc(var(--dx) * 0.9), calc(var(--dy) * 0.9), 0)
              rotate(calc(var(--rot) * 0.6))
              scale(1);
          }
          100% {
            opacity: 0;
            transform:
              translate3d(var(--dx), calc(var(--dy) + 30px), 0)
              rotate(var(--rot))
              scale(0.6);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          span { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}

export const TokenAwardAnimation = memo(TokenAwardAnimationImpl);
