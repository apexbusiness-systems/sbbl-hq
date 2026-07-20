/**
 * PaywallGate — broadcast access gate for non-subscriber, non-entitled users.
 *
 * ACCESS RULES (enforced server-side by get_active_broadcast):
 *   RULE 1 — Only registered users (authenticated + onboarding complete) reach this gate.
 *   RULE 2 — Anon users see a "Register to Watch" CTA → /onboarding?intent=fan&redirect=/live
 *   RULE 3 — Authenticated users with incomplete onboarding are redirected, never reach here.
 *   RULE 4 — Premium subscribers (subscription_ends_at > now()) bypass this gate entirely.
 *   RULE 5 — Non-subscribers without PPV entitlement see Panel A (code) + Panel B (purchase).
 *   RULE 6 — Players/Coaches follow the same rules as fans — role ≠ free access.
 *   RULE 7 — Super-admins bypass all gates (handled in Live.tsx before this renders).
 *   RULE 8 — stream_url is NEVER sent to the client unless the user is permitted.
 *            get_active_broadcast() enforces this entirely server-side.
 *
 * Modes:
 *   Mode A — anon user: single "Register to Watch" CTA
 *   Mode B — registered user with no entitlement: Panel A (code) + divider + Panel B (purchase)
 */

import { KeyboardEvent, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api/client';
import { useTurnstile } from '@/hooks/use-turnstile';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const S = {
  overlay:   'absolute inset-0 z-20 flex flex-col items-center justify-center',
  bg:        'bg-black/85 backdrop-blur-sm',
  card:      'flex flex-col gap-4 px-6 py-7 rounded-xl max-w-sm w-full mx-4 bg-[#111111] border border-[#1A1A1A]',
  badge:     'text-[11px] font-bold tracking-[0.2em] uppercase text-[#E63946]',
  headline:  'text-[#F5F5F0] font-bold text-lg text-center leading-snug',
  sub:       'text-[#8A8A8A] text-sm text-center leading-relaxed',
  label:     'text-[10px] font-semibold uppercase tracking-wider text-[#8A8A8A]',
  input:     [
    'w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3',
    'text-[#F5F5F0] text-sm font-mono tracking-widest placeholder-[#444]',
    'focus:outline-none focus:border-[#C9A84C]/50',
  ].join(' '),
  btn:       [
    'w-full py-3 rounded-lg font-bold text-sm tracking-wide',
    'bg-[#C9A84C] text-[#0A0A0A]',
    'hover:bg-[#E8C76A] active:scale-[0.98]',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  btnGhost:  [
    'w-full py-3 rounded-lg font-bold text-sm tracking-wide',
    'border border-[#C9A84C] text-[#C9A84C]',
    'hover:bg-[#C9A84C]/10 active:scale-[0.98]',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  errText:   'text-[#E63946] text-xs text-center',
  successBg: 'w-full rounded-lg bg-emerald-900/40 border border-emerald-600/40 px-4 py-3 text-emerald-300 text-sm text-center',
  divider:   'flex items-center gap-3 text-[#3A3A3A] text-xs font-semibold',
  divLine:   'flex-1 h-px bg-[#2A2A2A]',
} as const;

const CODE_ERRORS: Record<string, string> = {
  invalid_code:      "That code doesn't exist. Check and try again.",
  code_expired:      'This code has expired.',
  code_already_used: 'This code has already been used.',
  not_authenticated: 'You must be signed in to redeem a code.',
};

export interface PaywallGateProps {
  /** active_game_id from get_active_broadcast — null for open broadcasts */
  gameId?: string | null;
  /** The title returned by get_active_broadcast */
  title?: string | null;
  /** Whether the broadcast is currently live */
  isLive?: boolean;
  /** Called after successful code redemption or PPV purchase — triggers broadcast refetch */
  onSuccess?: () => void;
  /** For anon mode — redirects to /onboarding?intent=fan&redirect=/live */
  onWatchClick?: () => void;
  /** When true, renders the anon "Register to Watch" mode (Panel A + B hidden) */
  isAnon?: boolean;
}

export function PaywallGate({
  gameId,
  title,
  isLive = true,
  onSuccess,
  onWatchClick,
  isAnon = false,
}: PaywallGateProps) {
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { containerRef, resolveToken } = useTurnstile();

  const handleRedeemCode = async () => {
    const trimmed = code.toUpperCase().trim();
    if (!trimmed) return;

    setCodeLoading(true);
    setCodeError(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('not_authenticated');

      const { data, error } = await supabase.rpc('redeem_ppv_invite', {
        p_code: trimmed,
      });

      if (error) {
        setCodeError(CODE_ERRORS['invalid_code']);
        return;
      }

      const result = data as { ok: boolean; error?: string } | null;

      if (result?.ok) {
        setCodeSuccess(true);
        setTimeout(() => onSuccess?.(), 1500);
      } else {
        const errKey = result?.error ?? 'invalid_code';
        setCodeError(CODE_ERRORS[errKey] ?? CODE_ERRORS['invalid_code']);
      }
    } catch {
      setCodeError(CODE_ERRORS['invalid_code']);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCodeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleRedeemCode();
  };

  const handlePurchase = async () => {
    if (!gameId) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const captchaToken = await resolveToken();
      const res = await apiFetch<{ url: string }>(
        `/api/streams/${gameId}/purchase`,
        {
          method: 'POST',
          body: JSON.stringify({
            successUrl: `${window.location.origin}/live?ppv=success`,
            cancelUrl:  `${window.location.origin}/live`,
            captchaToken,
          }),
        },
      );
      if (!res.url) throw new Error('No checkout URL returned');
      window.location.href = res.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Payment unavailable. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className={`${S.overlay} ${S.bg}`}>
      {/* Hidden Turnstile container for purchase flow */}
      <div ref={containerRef} className="hidden" />

      <div className={S.card}>
        {/* Live badge */}
        <span className={`${S.badge} text-center`}>
          {isLive ? '● LIVE NOW' : 'UPCOMING'}
        </span>

        {/* Broadcast title */}
        <p className={S.headline}>
          {title ?? 'SBBL Live Stream'}
        </p>

        {/* ── Mode A — Anon user ───────────────────────────────────────────── */}
        {isAnon && (
          <>
            <p className={S.sub}>
              Create a free account to access live games and purchase PPV access.
            </p>
            <div className="text-center">
              <span className="text-[#C9A84C] font-bold text-2xl">$3.99</span>
              <span className="text-[#8A8A8A] text-xs ml-1">/ game day</span>
            </div>
            <button className={S.btn} onClick={onWatchClick}>
              Register to Watch →
            </button>
          </>
        )}

        {/* ── Mode B — Registered user, no entitlement ─────────────────────── */}
        {!isAnon && (
          <>
            {/* PANEL A — Code Redemption */}
            <div className="flex flex-col gap-2">
              <p className={S.label}>Have a Free Access Code?</p>
              <p className="text-[#8A8A8A] text-xs leading-relaxed">
                Enter the code shared by SBBL to watch for free.
              </p>

              {codeSuccess ? (
                <div className={S.successBg}>
                  Access granted! Loading your stream…
                </div>
              ) : (
                <>
                  <input
                    className={S.input}
                    placeholder="SBBL-XXXX-XXXX"
                    value={code}
                    maxLength={14}
                    onChange={(e) => {
                      setCodeError(null);
                      setCode(e.target.value.toUpperCase());
                    }}
                    onKeyDown={handleCodeKeyDown}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {codeError && (
                    <p className={S.errText}>{codeError}</p>
                  )}
                  <button
                    className={S.btnGhost}
                    onClick={() => void handleRedeemCode()}
                    disabled={codeLoading || !code.trim()}
                  >
                    {codeLoading ? 'Verifying…' : 'Redeem Code'}
                  </button>
                </>
              )}
            </div>

            {/* Divider */}
            {!codeSuccess && (
              <div className={S.divider}>
                <span className={S.divLine} />
                <span>— OR —</span>
                <span className={S.divLine} />
              </div>
            )}

            {/* PANEL B — Purchase Access (existing Stripe flow — do not modify) */}
            {!codeSuccess && (
              <div className="flex flex-col gap-2">
                <p className={S.label}>Purchase Access</p>
                <p className="text-[#8A8A8A] text-xs leading-relaxed">
                  Pay once per game day. Watch on this device.
                </p>
                <div className="text-center">
                  <span className="text-[#C9A84C] font-bold text-2xl">$3.99</span>
                  <span className="text-[#8A8A8A] text-xs ml-1">/ game day</span>
                </div>
                {checkoutError && (
                  <p className={S.errText}>{checkoutError}</p>
                )}
                <button
                  className={S.btn}
                  onClick={() => void handlePurchase()}
                  disabled={checkoutLoading || !gameId}
                >
                  {checkoutLoading ? 'Loading…' : 'Fan Up — Watch Now →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
