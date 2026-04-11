import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api/client';
import { useTurnstile } from '@/hooks/use-turnstile';
import { type AccessState, type LiveConfig } from '@/hooks/useLiveAccess';

// ─── BRAND TOKENS ──────────────────────────────────────────────────────────
const S = {
  overlay:   'absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto',
  bg:        'bg-black/80 backdrop-blur-sm',
  card:      'flex flex-col items-center gap-2 sm:gap-4 px-4 py-3 sm:px-6 sm:py-8 rounded-xl max-w-xs w-full mx-4 my-auto',
  cardBg:    'bg-[#111111] border border-[#1A1A1A]',
  badge:     'text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase',
  badgeLive: 'text-[#E63946]',
  badgeOff:  'text-[#8A8A8A]',
  headline:  'text-[#F5F5F0] font-bold text-base sm:text-xl text-center leading-snug',
  sub:       'text-[#8A8A8A] text-xs sm:text-sm text-center hidden sm:block',
  price:     'text-[#C9A84C] font-bold text-xl sm:text-2xl',
  btn:       [
    'w-full py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wide',
    'bg-[#C9A84C] text-[#0A0A0A]',
    'hover:bg-[#E8C76A] active:scale-[0.98]',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  btnGhost:  [
    'w-full py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm tracking-wide',
    'border border-[#C9A84C] text-[#C9A84C]',
    'hover:bg-[#C9A84C]/10 active:scale-[0.98]',
    'transition-all duration-150',
  ].join(' '),
} as const;

const INTENT_KEY = 'sbbl_ppv_intent';

interface LiveGateProps {
  access: AccessState;
  config: LiveConfig;
  /** Full API path for the stream purchase endpoint, e.g. /api/streams/:gameId/purchase */
  checkoutEndpoint: string;
}

export function LiveGate({ access, config, checkoutEndpoint }: LiveGateProps) {
  const navigate = useNavigate();
  const { containerRef, resolveToken } = useTurnstile();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const openCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const captchaToken = await resolveToken();
      const res = await apiFetch<{ url: string }>(
        checkoutEndpoint,
        {
          method: 'POST',
          body: JSON.stringify({
            successUrl: `${window.location.origin}/live?ppv=success`,
            cancelUrl: `${window.location.origin}/live`,
            captchaToken,
          }),
        },
      );
      if (!res.url) throw new Error('No checkout URL');
      window.location.href = res.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment unavailable';
      setCheckoutError(msg);
    } finally {
      setCheckoutLoading(false);
    }
  }, [checkoutEndpoint, resolveToken]);

  // Auto-open paywall if returning from signup with PPV intent
  useEffect(() => {
    if (access === 'paywall') {
      const intent = sessionStorage.getItem(INTENT_KEY);
      if (intent === 'ppv') {
        sessionStorage.removeItem(INTENT_KEY);
        openCheckout();
      }
    }
  }, [access, openCheckout]);

  const handleSignUpClick = useCallback(() => {
    sessionStorage.setItem(INTENT_KEY, 'ppv');
    navigate('/login?mode=signup&redirect=/live&intent=ppv');
  }, [navigate]);

  // 'free' or 'paid' → no overlay, render nothing (player shows through)
  if (access === 'free' || access === 'paid' || access === 'loading') {
    return null;
  }

  return (
    <div className={`${S.overlay} ${S.bg}`}>
      {/* Hidden Turnstile widget container */}
      <div ref={containerRef} className="hidden" />

      <div className={`${S.card} ${S.cardBg}`}>

        {/* Live badge */}
        <span className={`${S.badge} ${config.isLive ? S.badgeLive : S.badgeOff}`}>
          {config.isLive ? '● LIVE NOW' : 'UPCOMING'}
        </span>

        {/* Headline */}
        <p className={S.headline}>
          {config.title ?? 'SBBL Live Stream'}
        </p>

        {access === 'unauthenticated' && (
          <>
            <p className={S.sub}>
              Create a free account to access live games.
            </p>
            <div className={S.price}>$4.99</div>
            <button className={S.btn} onClick={handleSignUpClick}>
              Sign Up to Watch →
            </button>
            <button
              className={S.btnGhost}
              onClick={() => navigate('/login?redirect=/live&intent=ppv')}
            >
              Already a member? Sign In
            </button>
          </>
        )}

        {access === 'paywall' && (
          <>
            <p className={S.sub}>
              Pay once per game day. Watch on this device.
            </p>
            <div className={S.price}>$4.99</div>
            {checkoutError && (
              <p className="text-[#E63946] text-xs text-center">{checkoutError}</p>
            )}
            <button
              className={S.btn}
              onClick={openCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Loading…' : 'Fan Up — Watch Now →'}
            </button>
          </>
        )}

      </div>
    </div>
  );
}
