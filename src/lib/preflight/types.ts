/**
 * Viewer preflight — pure types.
 *
 * Every check returns a CheckResult. Consumers render a CheckResult the
 * same way regardless of which check produced it. Status `warn` is
 * non-blocking (user may proceed); `fail` is blocking (remediation
 * required before playback is attempted).
 */
export type CheckId =
  | 'auth'
  | 'entitlement'
  | 'activeSession'
  | 'browserSupport'
  | 'bandwidth'
  | 'autoplay'
  | 'replay';

export type CheckStatus = 'pending' | 'pass' | 'warn' | 'fail' | 'skipped';

/** Game lifecycle state relevant to the preflight surface. */
export type GameStreamState =
  | 'upcoming'
  | 'live'
  | 'halftime'
  | 'ended_replay'
  | 'ended_no_replay'
  | 'unavailable';

/**
 * A single check's result. `remediation` carries both the copy and the
 * action — the UI layer maps `action` to a concrete CTA handler.
 */
export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  label: string;
  /** Human-readable sub-label, shown under the check label on fail/warn. */
  detail?: string;
  remediation?: {
    /** Visible button text. */
    cta: string;
    /**
     * Semantic action key. Orchestrator maps this to an actual handler
     * so UI components stay framework-agnostic and server-agnostic.
     */
    action:
      | 'sign_in'
      | 'purchase_ppv'
      | 'redeem_code'
      | 'displace_session'
      | 'wait_for_replay'
      | 'buy_replay'
      | 'retry'
      | 'contact_support';
    /** Optional URL for `wait_for_replay` countdowns etc. */
    payload?: Record<string, unknown>;
  };
}

/**
 * Server-side preflight snapshot. Shape mirrors the
 * GET /api/streams/:gameId/preflight response. All fields are
 * derivable from a single server round-trip so the UI does not fan out
 * to multiple endpoints mid-check.
 */
export interface PreflightSnapshot {
  ok: true;
  /** auth.uid() of the caller, null when anonymous. */
  userId: string | null;
  entitlement: {
    status: 'active' | 'absent' | 'expired';
    expiresAt: string | null;
  };
  activeSession: {
    hasConflict: boolean;
    conflictDeviceLabel: string | null;
    conflictStartedAt: string | null;
  };
  game: {
    id: string;
    state: GameStreamState;
    tipoffAt: string | null;
    ppvPriceCad: number | null;
    replay: {
      embargoEndsAt: string | null;
      qualityTier: 'raw' | 'edited' | null;
      priceCad: number | null;
      entitled: boolean;
    };
  };
}
