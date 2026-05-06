# Facebook Universal Ingest Plan (Additive / Zero-Regression)

## Diagnosis
- Current player intentionally bypasses Facebook SDK to prevent CSP/script storms and regressions on YouTube/Twitch.
- Facebook links are detected, but browser-only playback is constrained unless a direct HLS source is available.
- This is a platform-policy + extraction problem, not a rendering-engine defect.

## Additive Architecture (No edits to existing player path)
1. **Resolver service (server-side only):**
   - Input: facebook/fb.watch URL.
   - Output: signed short-lived HLS URL + metadata.
   - Runs in isolated worker with strict rate limiting and auditable logs.
2. **Relay/normalizer edge:**
   - Normalizes transport, caches short windows, and emits a stable `.m3u8` target.
3. **Feature-gated adapter endpoint:**
   - New API route returns resolver status (`ready`, `pending`, `blocked-policy`, `error`).
4. **Client integration (future phase):**
   - If feature flag OFF: existing behavior unchanged.
   - If ON and resolver returns `ready`: use HLS URL branch already supported by player stack.

## Security / Reliability Controls
- Tokenize every request; deny anonymous high-volume probes.
- Per-domain quotas + circuit breaker for upstream policy changes.
- Cache key isolation to avoid cross-tenant media leakage.
- SLA probes for resolver availability and latency percentiles.

## Rollout Strategy
- Phase 0: shadow mode (collect only, no playback impact).
- Phase 1: internal tenant allowlist.
- Phase 2: progressive rollout with automated rollback on error budget breach.

## Immediate Engineering Artifact Added
- `src/lib/stream/facebook-universal-ingest.ts`: deterministic assessment helper for routing decisions.
- `src/test/facebook-universal-ingest.test.ts`: contract tests for additive decision logic.

This plan preserves current Twitch/YouTube behavior by design and introduces universal ingest through opt-in backend resolution.
