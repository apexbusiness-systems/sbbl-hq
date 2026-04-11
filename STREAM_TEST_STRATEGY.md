<!-- Version: v1.1.0 | Date: 2026-04-11 | Status: Current -->
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

2. Integration (`src/test/stream/rate-limit.int.test.ts`)
- Resume behavior does not inflate active viewer count
- Burst abuse is blocked deterministically

3. E2E (`e2e/stream-validation.spec.ts`)
- Entitled playback validates media proof signals (no text-only pass)
- Unauthenticated viewer remains gated and cannot access video element

4. Performance (`ops/validation/stream-validation.mjs` + `ops/validation/stream-thresholds.json`)
- Latency checks against hard thresholds
- Failure is gating

5. Gate/Artifact Checks (`ops/validation/stream-validation.mjs`)
- Sensitive-string leak scan across generated artifacts
- Deterministic `VERIFIED | REJECTED` verdict

6. 20K Concurrent-User Stress Battery (`src/test/stream-20k-stress.test.ts`)
- Gated behind `STRESS=1` environment variable; excluded from standard CI
- 20,000 simulated concurrent viewers across 10 waves × 2,000 users
- Each user executes: public status poll → session create → heartbeat → chat message
- Validates SLOs for p99 latency, error rate (< 0.1%), viewer count accuracy (< 2% drift),
  idempotency (zero duplicates on replay), and memory (< 1 024 MB heap)
- `InMemorySupabase` mock supports `.eq()`, `.neq()`, `.upsert(onConflict)`, `batch_heartbeat_upsert`,
  `consume_stream_rate_limit` — covers the full worker handler query surface

7. Chaos Battery (`src/test/stream-chaos-battery.test.ts`, `src/test/ops-chaos-battery.test.ts`)
- 11 adversarial scenarios covering: token expiry mid-broadcast, rapid live/offline toggling,
  transient 500 errors, double-401 fail-closed, concurrent multi-tab refresh, network timeouts,
  null-token auto-fetch, and sustained 401 turbulence
- Run unconditionally in CI; no environment gate required

## Run Commands
- `npm run test:stream:unit`
- `npm run test:stream:int`
- `npm run test:stream:e2e`
- `npm run test:stream:perf`
- `npm run validate:stream:gate`
- `npm run validate:prelive`
- `STRESS=1 npx vitest run src/test/stream-20k-stress.test.ts --reporter=verbose`  ← 20K stress (manual)
- `npx vitest run src/test/stream-chaos-battery.test.ts src/test/ops-chaos-battery.test.ts`  ← chaos battery

## Artifact Contract
Each prelive run emits:
- `validation-report.json`
- `verification-matrix.md`
- `performance-summary.json`
- `audit-summary.json`
- `artifacts/stream-validation/<validation_run_id>/...`

## Failure Policy
Any missing required evidence produces `REJECTED`.

## Changelog

| Version | Date | Change |
|---------|------|--------|
| v1.1.0 | 2026-04-11 | Added 20K stress battery layer and chaos battery layer; documented run commands and SLO thresholds |
| v1.0.0 | 2026-04-10 | Initial strategy document |
