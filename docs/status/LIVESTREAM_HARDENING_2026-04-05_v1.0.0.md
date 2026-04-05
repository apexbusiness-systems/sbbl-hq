<!-- Version: v1.0.0 | Date: 2026-04-05 | Status: Current -->
# Livestream Pipeline Hardening — Status Snapshot

**Date:** 2026-04-05
**Author:** APEX Business Systems Ltd. — Engineering
**Scope:** Full livestream pipeline audit, fix, and stress validation

---

## Executive Summary

A comprehensive hardening pass was executed against the SBBL HQ livestream pipeline on 2026-04-05. The pass identified and resolved a critical stale-token authentication loop, consolidated duplicate admin control surfaces, added viewer-facing error handling and connection resilience, and validated the system under 20,000 concurrent simulated users with zero errors and zero data corruption.

---

## Issues Identified and Resolved

### Critical

| # | Issue | Root Cause | Resolution |
|---|---|---|---|
| 1 | Endless 401 errors on `ops/streams/config` | `apiFetch` 401 retry guard skipped when explicit token was passed | Retry guard now fires regardless of token source; same-token loop prevention added |
| 2 | Admin stream controls never loaded config | Stale closure token from `useAuth()` passed to polling | All polling uses `null` token → `apiFetch` auto-fetches fresh JWT |
| 3 | Duplicate stream URL ingestion points | Ops console and Live page both wrote to `collection_id` | Ops streams tab removed entirely; single control surface on Live page |

### High

| # | Issue | Resolution |
|---|---|---|
| 4 | ReactPlayer silent failure on bad URLs | Added `onError` → "Stream Unavailable" with Retry button |
| 5 | Silent heartbeat failures (battery drain) | Circuit breaker: 3 failures → stop interval + "Connection lost" banner |
| 6 | Infinite "Loading live game data..." | Synthetic game shell when live without scheduled game; "No Active Broadcast" otherwise |
| 7 | Go Live partial failure (config saves, toggle fails) | Separate error paths with specific toast messages |
| 8 | Dead `WhepPlayer` component | Deleted (never imported, legacy WebRTC code) |

---

## Changes Shipped (4 commits)

### Commit 1: `fix: eliminate stale-token 401 loop`
- `src/lib/api/client.ts` — `apiFetch` always retries on 401 with refresh
- `src/pages/Live.tsx` — polling uses auto-refresh auth
- `src/components/LiveStreamPlayer.tsx` — `token` prop removed
- `src/test/apifetch-401-retry.test.ts` — 5 regression tests

### Commit 2: `refactor: single stream control surface`
- `src/pages/Live.tsx` — `AdminStreamOverlay` (gear-icon dropdown on video wrapper)
- `src/pages/Ops.tsx` — streams tab removed, unused imports/state cleaned
- `src/test/stream-chaos-battery.test.ts` — 8 chaos tests

### Commit 3: `harden: broadcast resilience`
- `src/components/LiveStreamPlayer.tsx` — ReactPlayer error/ready handlers, heartbeat circuit breaker, connection-lost banner
- `src/pages/Live.tsx` — Go Live atomicity, no-game fallback
- Deleted `src/components/WhepPlayer.tsx`

### Commit 4: `test: 20,000 concurrent user stress battery`
- `src/test/stream-20k-stress.test.ts` — 7 stress tests, 93s runtime

---

## Test Results

### Full Suite
- **38 test files, 166 tests — all passing**
- Zero type errors (`tsc --noEmit`)
- Clean build (`vite build`)

### 20K Stress Battery

| Handler | Calls | Errors | p50 | p99 | Error Rate |
|---|---|---|---|---|---|
| Public Status | 20,000 | 0 | 103ms | 253ms | 0.000% |
| Playback Session | 20,000 | 0 | 922ms | 2,385ms | 0.000% |
| Heartbeat | 20,000 | 0 | 1,191ms | 2,777ms | 0.000% |
| Chat | 20,000 | 0 | 1,338ms | 3,052ms | 0.000% |

### Invariants Verified at 20K Scale

| Invariant | Result |
|---|---|
| Error rate | 0.000% |
| Session duplicates | 0 |
| Viewer count drift | 0.00% |
| Cache hit rate | 90.0% |
| Heap usage | 430.5MB (< 512MB budget) |
| Total DB operations | 328,000 |
| Idempotency under replay | 0 new rows from 20K replayed requests |

---

## Files Modified

| File | Change Type |
|---|---|
| `src/lib/api/client.ts` | Modified — 401 retry guard hardened |
| `src/pages/Live.tsx` | Modified — overlay controls, no-game fallback, auth cleanup |
| `src/pages/Ops.tsx` | Modified — streams tab removed |
| `src/components/LiveStreamPlayer.tsx` | Modified — error handling, circuit breaker, token prop removed |
| `src/components/WhepPlayer.tsx` | Deleted — dead code |
| `src/test/apifetch-401-retry.test.ts` | Created — 5 tests |
| `src/test/stream-chaos-battery.test.ts` | Created — 8 tests |
| `src/test/stream-20k-stress.test.ts` | Created — 7 tests |

---

## Documentation Updated

| Document | From | To | Change |
|---|---|---|---|
| LIVESTREAM_WORKFLOW_AUDIT | v1.0.0 | v2.0.0 | Complete rewrite reflecting hardening pass + 20K results |
| STREAM_GATING | v1.2.0 | v1.3.0 | Auth auto-refresh, circuit breaker, single control surface |
| API_REFERENCE | v1.1.0 | v1.2.0 | JWT-only auth, correct ops routes, error model expanded |
| OPERATIONS_RUNBOOK | v1.3.0 | v1.4.0 | Stream flow updated, admin overlay, auth resilience |
| docs/README.md | v2.1.0 | v2.2.0 | Version bumps, new status snapshot linked |

---

**Status: PRODUCTION-READY. All gates pass. No open items.**
