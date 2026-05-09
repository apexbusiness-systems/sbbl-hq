## STREAMING_GAPS

### 1) Live stream validation depends on manual checks
- **Gap description:** Core live WHEP playback and one-device enforcement still require manual pre-event verification.
- **Blast radius:** A failed entitlement/session lock could be missed until fans are already trying to watch.
- **Recommended mitigation:** Add a synthetic canary account + scheduled Playwright smoke run against staging/live every 15 minutes on event day.
- **Priority:** **P0**

### 2) Single-worker runtime is a critical dependency
- **Gap description:** Health, paywall, stream session creation, and replay gating all depend on one Cloudflare Worker route.
- **Blast radius:** If Worker routing/secrets break, checkout, auth-gating, and playback authorization all fail simultaneously.
- **Recommended mitigation:** Configure secondary Worker environment + failover DNS/route playbook with one-click rollback.
- **Priority:** **P0**

### 3) Stripe webhook status check is out-of-band and human-driven
- **Gap description:** Payment entitlement pipeline relies on operator manually confirming webhook health.
- **Blast radius:** Purchases may succeed in Stripe but entitlements are not minted, blocking paid viewers.
- **Recommended mitigation:** Add automated alert when webhook failures exceed threshold or no successful delivery in 30 minutes on event day.
- **Priority:** **P1**

### 4) Replay readiness is configuration-sensitive
- **Gap description:** Replay availability depends on a UI toggle and operator memory.
- **Blast radius:** Event finishes with no replay artifact, causing revenue/support impact for replay buyers.
- **Recommended mitigation:** Auto-enable record-to-replay for all paid live events by default; require explicit opt-out.
- **Priority:** **P1**
