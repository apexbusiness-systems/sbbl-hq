/**
 * SplashScreen.tsx
 *
 * Full-screen launch screen shown during the initial AuthContext boot.
 * Displays the SBBL HQ brand mark with entrance animations, then fades out
 * once auth resolves. A 1100ms minimum ensures the screen doesn't flash
 * on fast-cached sessions.
 *
 * Uses a local optimized PNG from /public/icons for faster decode + paint.
 * Typography is Space Grotesk only.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

const MIN_DISPLAY_MS = 1100;

export function SplashScreen() {
  const { loading } = useAuth();
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const minElapsed = useRef(false);
  const authDone = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      minElapsed.current = true;
      if (authDone.current) triggerExit();
    }, MIN_DISPLAY_MS);

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading) {
      authDone.current = true;
      if (minElapsed.current) triggerExit();
    }
  }, [loading]);

  function triggerExit() {
    setExiting(true);
    setTimeout(() => setHidden(true), 420);
  }

  if (hidden) return null;

  return (
    <div
      aria-hidden="true"
      className={exiting ? 'splash-exit' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div
        className="splash-glow"
        style={{
          position: 'absolute',
          width: 340,
          height: 340,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(201,168,76,0.22) 0%, rgba(249,115,22,0.08) 55%, transparent 80%)',
          pointerEvents: 'none',
        }}
      />

      <div className="splash-rise" style={{ position: 'relative', marginBottom: 32 }}>
        <svg
          className="splash-orbit"
          viewBox="0 0 200 200"
          width={160}
          height={160}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id="sp-ring" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
          <ellipse
            cx="100"
            cy="100"
            rx="94"
            ry="30"
            fill="none"
            stroke="url(#sp-ring)"
            strokeWidth="4"
            strokeDasharray="12 8"
            opacity="0.55"
          />
          <ellipse
            cx="100"
            cy="100"
            rx="94"
            ry="30"
            fill="none"
            stroke="url(#sp-ring)"
            strokeWidth="4"
            strokeDasharray="6 18"
            opacity="0.25"
            transform="rotate(60 100 100)"
          />
        </svg>

        <img
          src="/icons/icon-splash.svg"
          alt="SBBL HQ"
          width={160}
          height={160}
          loading="eager"
          style={{
            display: 'block',
            borderRadius: 36,
            boxShadow: '0 0 48px rgba(201,168,76,0.28), 0 8px 32px rgba(0,0,0,0.6)',
          }}
          draggable={false}
        />
      </div>

      <div
        className="splash-wordmark"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '0.06em',
            background: 'linear-gradient(135deg, #F5F5F0 30%, #C9A84C 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SBBL
        </span>
        <span
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '0.08em',
            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            paddingBottom: 4,
          }}
        >
          HQ
        </span>
      </div>

      <p
        className="splash-tag"
        style={{
          marginTop: 14,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          color: 'rgba(245,245,240,0.38)',
        }}
      >
        Three Leagues · One Platform
      </p>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            'linear-gradient(90deg, transparent, #C9A84C 40%, #f97316 70%, transparent)',
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  );
}
