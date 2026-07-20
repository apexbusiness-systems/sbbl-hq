# Correction: Universal PPV Pricing Update to $3.99 CAD

- **Date:** 2026-07-20
- **Scope:** Project-wide (Backend Workers, Frontend Components, Test Suites, and Documentation)
- **Affected Pages:** `src/worker/index.ts`, `src/lib/auth/subscription.ts`, `src/components/LiveStreamPlayer.tsx`, `src/components/live/PaywallGate.tsx`, `src/components/live/LiveGate.tsx`, `src/components/CASLNudge.tsx`, `src/pages/Live.tsx`, test files under `src/test/`, and `e2e/viewer-preflight.spec.ts`
- **Promotion Decision:** User-pattern rule & core directive

## Original Assumptions vs. Corrected State

### 1. Livestream PPV Price Constancy
- **Original Assumption:** PPV pricing was universally hardcoded to $4.99 CAD (represented as 499 cents inside Stripe payloads and as 4.99 inside preflight/playback calculations).
- **Corrected State:** Business strategy changes dictated a universal stream pricing update to $3.99 CAD ($3.99 per view).
- **Resolution:**
  - **Worker Backend:** Updated the hardcoded PPV price inside `src/worker/index.ts` from `499` cents to `399` cents and updated the preflight response payload `ppvPriceCad` from `4.99` to `3.99`.
  - **Shared Constants:** Updated `PPV_PRICE_CAD` from `4.99` to `3.99` in `src/lib/auth/subscription.ts` and `src/components/LiveStreamPlayer.tsx`.
  - **UI/UX Pricing Displays:** Replaced all static `$4.99` JSX pricing elements with `$3.99` in `PaywallGate.tsx`, `LiveGate.tsx`, `CASLNudge.tsx`, and `Live.tsx` to ensure visual consistency.
  - **Test Suite Updates:** Updated assertions in `session-enforcement.test.ts` (adjusting $4.99 base price checks to $3.99, and the corresponding tax-inclusive price from $5.24 to $4.19 reflecting Alberta's 5% GST), `subscription.test.ts`, `preflight-checks.test.ts`, and `preflight-viewer-orchestrator.test.tsx` to match the new $3.99 base price.
  - **E2E Mocks:** Updated mock payloads in Playwright spec files (`e2e/viewer-preflight.spec.ts`) from 4.99 to 3.99.
  - **Documentation Alignment:** Updated `COMPLETE_CODEBASE_MAP_v1.0.0.md` and `LIVESTREAM_INGEST_BROADCAST_SYSTEM_INTEGRITY_AUDIT_2026-04-09_v1.0.0.md` to reflect the updated pricing structure.
