/**
 * CASLNudge.tsx — Canadian Anti-Spam Legislation compliant upgrade nudge
 *
 * Rules (non-negotiable):
 *   - One nudge per browser SESSION only (sessionStorage key, not localStorage)
 *   - Appears only for free fans who are not already paid_fan/player/admin
 *   - No modal overlay, no dark patterns, no autoplay
 *   - Easy ✕ dismiss visible immediately
 *   - Does NOT re-appear after dismiss within the same session
 *   - Respects CASL: no pre-checked boxes, clear sender identity, easy unsubscribe
 *     reminder shown inline
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { AppRole } from '@/lib/auth/roles';

const SESSION_KEY = 'casl_nudge_dismissed_v1';

type PremiumRole = Exclude<AppRole, 'fan'>;

// Roles that indicate the user already has premium access — no nudge needed
const PREMIUM_ROLES: readonly PremiumRole[] = [
  'paid_fan',
  'player',
  'team_manager',
  'league_admin',
  'media_operator',
  'store_operator',
  'super_admin',
] as const;

interface CASLNudgeProps {
  readonly roles: AppRole[];
}

export function CASLNudge({ roles }: CASLNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Gate: must be a registered fan without any premium role
    const isFan = roles.includes('fan');
    const hasPremium = roles.some((r) => PREMIUM_ROLES.includes(r as PremiumRole));

    if (!isFan || hasPremium) return;

    // One nudge per session — sessionStorage resets on tab/browser close
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Small delay so it doesn't flash immediately on page load
    const timer = setTimeout(() => setVisible(true), 2800);
    return () => clearTimeout(timer);
  }, [roles]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Upgrade offer"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 w-[288px] bg-background border border-border rounded-2xl shadow-2xl p-4 animate-fade-in"
    >
      {/* Dismiss — must be immediately reachable, no delay */}
      <button
        onClick={dismiss}
        aria-label="Dismiss this offer"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-0.5"
      >
        <X className="w-4 h-4" />
      </button>

      {/* CASL compliance label */}
      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">
        SBBL HQ · One-time offer
      </p>

      <p className="text-sm font-semibold leading-snug pr-5">
        Get full game access + send a friend an invite — $3.99 per game.
      </p>

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
        You may unsubscribe from SBBL HQ marketing emails at any time via the
        link in any email we send. This notice appears once per session.
      </p>

      <div className="mt-3 flex gap-2">
        <a
          href="/billing"
          onClick={dismiss}
          className="flex-1 text-center bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 text-xs font-bold rounded-xl transition-colors"
        >
          Upgrade
        </a>
        <button
          onClick={dismiss}
          className="flex-1 text-center border border-border rounded-xl px-3 py-2 text-xs hover:bg-secondary transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
