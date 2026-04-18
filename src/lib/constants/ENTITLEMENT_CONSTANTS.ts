/**
 * Canonical entitlement / session windows.
 *
 * SINGLE SOURCE OF TRUTH for PPV access semantics. Any file that encodes a
 * numeric access, session, comp-code, replay, or embargo window MUST import
 * from here. Ad-hoc literals (6 * 60 * 60 * 1000, + 24, etc.) in business
 * logic are banned — grep-searchable and caught in code review.
 *
 * Semantic distinction that matters:
 *   ENTITLEMENT_VALIDITY_HOURS — how long a purchase stays valid before
 *     the buyer must start watching. A customer who buys at 7pm and the
 *     game gets delayed can still start next morning. Chargeback-safe.
 *   VIEWING_SESSION_MAX_SECONDS — once they start watching, the session
 *     is hard-capped at 6 hours (heartbeats clamp at max_expires_at).
 *     The session cap is independent of the entitlement window.
 *
 * The two are intentionally different. Do not conflate them.
 */
export const ENTITLEMENT = {
  /** Hard ceiling on a single playback session, regardless of entitlement. */
  VIEWING_SESSION_MAX_SECONDS: 21600, // 6 hours

  /** Purchase-to-first-playback validity for a Stripe-paid PPV entitlement. */
  ENTITLEMENT_VALIDITY_HOURS: 48,

  /** Default validity for a super-admin-issued comp / manual grant. */
  MANUAL_COMP_VALIDITY_HOURS: 48,

  /** Minimum embargo before a finished game becomes available for replay. */
  REPLAY_EMBARGO_DAYS: 7,

  /** CAD price for a raw (unedited) replay. */
  REPLAY_RAW_PRICE_CAD: 1.5,

  /** CAD price for the edited / premium replay. */
  REPLAY_EDITED_PRICE_CAD: 5.0,

  /** Validity from replay_monetization_enabled_at for raw replay. */
  REPLAY_RAW_VALIDITY_HOURS: 72,

  /** Validity from replay_monetization_enabled_at for edited replay. */
  REPLAY_EDITED_VALIDITY_DAYS: 30,
} as const;

export const ENTITLEMENT_MS = {
  VIEWING_SESSION_MAX: ENTITLEMENT.VIEWING_SESSION_MAX_SECONDS * 1000,
  ENTITLEMENT_VALIDITY: ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS * 60 * 60 * 1000,
  MANUAL_COMP_VALIDITY: ENTITLEMENT.MANUAL_COMP_VALIDITY_HOURS * 60 * 60 * 1000,
  REPLAY_EMBARGO: ENTITLEMENT.REPLAY_EMBARGO_DAYS * 24 * 60 * 60 * 1000,
  REPLAY_RAW_VALIDITY: ENTITLEMENT.REPLAY_RAW_VALIDITY_HOURS * 60 * 60 * 1000,
  REPLAY_EDITED_VALIDITY: ENTITLEMENT.REPLAY_EDITED_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
} as const;
