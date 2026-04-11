<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# STREAM_TEST_STRATEGY

## Objective
Provide deterministic pre-live validation for ingest, playback, paywall, one-device enforcement, resume behavior, expiry policy, interactions, and rate-limit resilience.

## Test Layers
1. Unit (`src/test/stream/validation-policy.unit.test.ts`)
- One-device rule decisions
- Six-hour entitlement expiry
- Signed playback artifact TTL constraints
- Sliding-window comment/reaction throttling
- Viewer counter dedupe behavior

1b. Unit (`src/test/stream/source-validator.unit.test.ts`)
- URL classification for HLS/MP4/YouTube/Twitch/Facebook
- Facebook normalization (`facebook.com/<slug>` → `/live`)
- Facebook rejection (`profile.php?id=...`)
- Public-source soft-paywall warning surfacing

2. Integration (`src/test/stream/rate-limit.int.test.ts`)
- Resume behavior does not inflate active viewer count
- Burst abuse is blocked deterministically

2b. Integration (`src/test/worker-stream-hardening.test.ts`)
- `/ops/streams/status` rejects `isLive=true` when `gameId` is missing
- `/api/streams/:gameId/test-source` returns deterministic invalid verdict for unsupported Facebook profile URLs

3. E2E (`e2e/stream-validation.spec.ts`)
- Entitled playback validates media proof signals (no text-only pass)
- Unauthenticated viewer remains gated and cannot access video element

4. Performance (`ops/validation/stream-validation.mjs` + `ops/validation/stream-thresholds.json`)
- Latency checks against hard thresholds
- Failure is gating

5. Gate/Artifact Checks (`ops/validation/stream-validation.mjs`)
- Sensitive-string leak scan across generated artifacts
- Deterministic `VERIFIED | REJECTED` verdict

## Run Commands
- `npm run test:stream:unit`
- `npm run test:stream:int`
- `npm run test:stream:e2e`
- `npm run test:stream:perf`
- `npm run validate:stream:gate`
- `npm run validate:prelive`

## Artifact Contract
Each prelive run emits:
- `validation-report.json`
- `verification-matrix.md`
- `performance-summary.json`
- `audit-summary.json`
- `artifacts/stream-validation/<validation_run_id>/...`

## Failure Policy
Any missing required evidence produces `REJECTED`.
