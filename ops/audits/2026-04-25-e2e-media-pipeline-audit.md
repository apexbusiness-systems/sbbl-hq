# End-to-End Media Pipeline Audit (Code-First)

Date: 2026-04-25
Scope: ingestion → playback → broadcast controls
Method: production entrypoint and route-path tracing from executable code only.

## Executive Verdict

**Not release-ready for strict paywalled livestream guarantees.**

- The `Live` page contains a direct Twitch/YouTube render branch that bypasses the entitlement/session-gated `LiveStreamPlayer` path, enabling playback without the normal `/session` gate and heartbeat enforcement when source type is twitch/youtube. (Confirmed production blocker.)
- CI/deploy pipelines include non-blocking gates (`continue-on-error`) for checks that can mask regressions and unhealthy deploys. (Confirmed release/process blockers.)
- Validation suites are heavily mocked and include auth bypass seams; they prove UI protocol compatibility, not real production enforcement.

## Production Entrypoints (Verified)

- Cloudflare Worker runtime entrypoint is `src/worker/validation-contract-wrapper.ts` via `wrangler.jsonc`/`wrangler.deploy.jsonc` `main` binding.
- Frontend runtime entrypoint is `src/main.tsx` and route entry for livestream is `/live` in `src/App.tsx`.
- Core API route registration for ingest/playback/broadcast resides in `src/worker/index.ts` route table.

## End-to-End Pipeline Map

### A) Ingestion Pipeline (ops/admin)

1. `POST /ops/ingest/presign` (super_admin + idempotency)
   - Generates signed Supabase upload URL for private media bucket.
2. Client uploads binary directly to signed URL.
3. `POST /ops/ingest/submit` (super_admin + idempotency)
   - Validates payload and POTG constraints.
   - Creates `ingest_jobs` row (`uploaded`), transitions `classified`→`validated`.
   - Writes `media_assets`, then `media_publications` projection.
   - Final state `projected` or `published`; audit log inserted.
4. Moderation lifecycle routes:
   - `/ops/ingest/:jobId` status
   - `/approve` publish
   - `/reject` archive/fail
   - `/replay` reset and rerun.

### B) Playback Pipeline (viewer)

1. `/live` page computes active game and stream source.
2. Normal gated path uses `LiveStreamPlayer`:
   - `/api/streams/:gameId/access` entitlement lookup.
   - `/api/streams/:gameId/session` creates/resumes session.
   - heartbeat `/session/heartbeat` and teardown `/session/end`.
   - comments/reactions require active session checks server-side.
3. Worker `handlePlaybackSession`:
   - role + entitlement gate
   - replay embargo/entitlement checks
   - stream URL selection and optional signed provider path
   - proxy cookie issuance for proxy-class delivery.
4. Stream proxy path:
   - `/api/streams/:gameId/proxy/*` validates signed proxy cookie and rewrites manifests.

### C) Broadcast/Admin-Control Pipeline

1. Admin UI overlay (`Live.tsx`) allows URL edits + go-live toggles.
2. API calls:
   - `/ops/streams/config` read/update
   - `/ops/streams/status` simple live toggle
   - `/ops/streams/go-live` atomic upsert for URL + live state.
3. Additional broadcast ops:
   - comp codes, comments moderation, reactions reset
   - OBS command queue routes under `/api/ops/obs/*` with role/token guards.
4. WHIP ingest client path:
   - `use-whip-ingest` publishes `MediaStream` to WHIP endpoint; teardown via DELETE Location.

## Confirmed Production Blockers

1. **Paywall/session bypass for Twitch/YouTube on `/live`**
   - `Live.tsx` renders raw `ReactPlayer` for twitch/youtube before `LiveStreamPlayer`, skipping the server-driven session/access gate and heartbeat lifecycle.
   - This path can expose live playback without one-device/session enforcement that `LiveStreamPlayer` normally enforces.
   - Classification: **confirmed production blocker**.

## Confirmed Release/Process Blockers

1. **Deploy health gate is explicitly non-blocking**
   - Deploy workflow marks post-deploy `/ops/health` gate with `continue-on-error: true`.
   - A bad health result can still ship as green deploy completion.
   - Classification: **confirmed process/release blocker**.

2. **CI typecheck for node/vite config is non-blocking**
   - `ci.yml` sets `continue-on-error: true` for one typecheck step.
   - Classification: **confirmed process/release blocker**.

## Coverage Gaps / False-Green Risks

1. **Prelive e2e is mock-heavy and stubs core media/auth paths**
   - `e2e/stream-validation.spec.ts` routes key APIs and media URLs with mocked responses and synthetic media events.
   - Good for deterministic UI checks; does not prove production infra behavior (real auth, real storage, real session DB constraints).

2. **Auth bypass seam exists for e2e route guards**
   - `RequireAdmin` honors `VITE_E2E_BYPASS_ADMIN === 'true'`.
   - Appropriate for tests, but contributes to CI green builds not exercising real role enforcement.

3. **Validation wrapper alias/rate-limit surface diverges from canonical paths**
   - Wrapper rate-limits/rewrites `/reactions`, while canonical production write route is `/react` in worker route table.
   - Risk: test wrapper protections may not mirror live route behavior exactly.

## Suspicious but Unproven

1. **Go-live cache bust comment says both global/per-game bust, but code only deletes global key directly.**
   - Could cause short-lived stale `?gameId=` status reads (TTL window), but impact appears bounded and not proven to break playback.

2. **Performance phase in `stream-validation.mjs` marks perf OK when server unreachable (`server_reachable=false => perfOk=true`).**
   - This can produce a softer gate under environment failures; needs policy confirmation whether intended.

## Not Verifiable from Repository Artifact

- Runtime DB schema/RLS correctness for all referenced tables/RPCs.
- Live Cloudflare Worker secret values and environment parity across staging/prod.
- Actual upstream broadcaster reliability (WHIP/WHEP origin availability, CORS at runtime).
- Real Stripe webhook behavior against live secret configuration.

## Priority Action List

1. Remove/guard the direct Twitch/YouTube render bypass and force all providers through `LiveStreamPlayer` gate.
2. Make deploy health gate blocking for production branch deploys.
3. Make CI node/vite typecheck blocking.
4. Add at least one non-mocked e2e smoke that hits deployed worker session/access/comment/reaction paths with real auth in staging.
5. Align validation-wrapper aliases/rate-limit rules with canonical `/react` route naming.
