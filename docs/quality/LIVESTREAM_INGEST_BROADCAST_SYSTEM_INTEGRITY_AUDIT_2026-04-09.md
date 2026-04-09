# Livestream + Link Ingest + Broadcast System Integrity Audit — 2026-04-09

## Scope

End-to-end audit of the production pipeline segments that affect:

1. livestream control plane and playback lifecycle,
2. media link ingest and publication projection,
3. cross-surface rendering/ops integrity and security.

Primary code surfaces reviewed:

- `src/worker/index.ts` (routing + auth + stream + ingest + webhook handlers)
- `src/pages/Live.tsx` (viewer/admin control surface)
- `src/lib/api/stream.ts` and `src/lib/api/ops.ts` (frontend API contract)
- ingest/stream migrations under `supabase/migrations/*`
- verification suites in `src/test/*`

## System map (current)

### A) Livestream control + playback pipeline

- Public stream status is served by `GET /api/streams/status` with edge caching and payload minimization.
- Admin controls use `POST /ops/streams/config` and `POST /ops/streams/status`.
- Viewer playback path is `POST /api/streams/:gameId/session` → returns playback URL and session metadata.
- Presence path is `POST /api/streams/:gameId/session/heartbeat` with in-worker queue + batched DB flush.
- Session teardown is `POST /api/streams/:gameId/session/end`.

### B) Link ingest + publication pipeline

- Canonical ingress family:
  - `POST /ops/ingest/presign`
  - `POST /ops/ingest/submit`
  - `GET /ops/ingest/:jobId`
  - `POST /ops/ingest/:jobId/approve`
  - `POST /ops/ingest/:jobId/reject`
  - `POST /ops/ingest/:jobId/replay`
- Ingest state machine persists into `ingest_jobs` and projects onto `media_publications`.
- Public media surface reads `media_publications` instead of raw ingest tables.

### C) Broadcast entitlement/security envelope

- Access checks use `can_user_view_stream` RPC and role checks before session creation.
- Stripe webhook path includes signature verification and duplicate-event suppression.
- RLS and policy hardening migrations exist for `ingest_jobs`, `media_publications`, and stream session support tables.

## Findings

## ✅ Strengths

1. **Single canonical ingest family is present and wired.**
   The worker registers a complete ingest route family with state machine transitions and audit logging.

2. **Publication-layer rendering contract is enforced.**
   Public media reads from `media_publications` (projection layer), reducing direct coupling to raw ingest payloads.

3. **Stream status data is edge-cached and playback URL is not public in status payload.**
   This limits sensitive URL exposure in poll responses and reduces DB pressure.

4. **Session cap and displacement model are implemented in storage layer path.**
   6-hour cap and one-device logic are represented in session creation/displacement flow + batch update function.

## ⚠️ Integrity risks

### RISK-1 (High): heartbeat endpoint acknowledges success before session validity is verified

**What was found**

- `handleStreamSessionHeartbeat` currently enqueues heartbeat entries and immediately returns `{ ok: true }` without checking that session row exists and is still active.
- Actual DB write and validity checks are deferred to `batch_heartbeat_upsert(...)` flush.

**Integrity impact**

- Displaced/ended/invalid sessions can receive successful heartbeat responses for up to flush interval windows.
- This weakens the documented displacement feedback loop (“next heartbeat returns not found”) and can delay user-visible disconnect behavior.

### RISK-2 (Medium): replay path mutates original ingest job then re-enters submit path creating a new job

**What was found**

- `handleIngestReplay` resets existing job state to `uploaded`, clears publication/media refs, then calls `handleIngestSubmit(...)` with synthesized request payload.
- `handleIngestSubmit` always inserts a new `ingest_jobs` row before processing.

**Integrity impact**

- Replay creates an additional ingest job while original job is left in a non-terminal state, which can inflate operational backlog and create reconciliation noise.
- This pattern can undermine “one logical artifact ↔ one lifecycle chain” traceability.

### RISK-3 (Low/Contract drift): frontend stream status type still models `collectionId` on public status

**What was found**

- `fetchPublicStreamStatus` type includes `collectionId` in response model.
- Worker status handler intentionally omits playback URL fields from public payload.

**Integrity impact**

- Not a runtime break today, but increases contract ambiguity and future misuse risk.
- Encourages accidental assumptions that public status may expose playback URL data.

## State assessment (whole-system)

- **Pipeline architecture:** coherent and mostly production-hardened.
- **Security posture:** strong baseline (JWT verification, role-gated ops routes, signed webhook checks, RLS hardening migrations).
- **Operational resilience:** generally strong (idempotency checks, audit logs, cache usage, stress-test coverage), with critical attention needed on heartbeat acknowledgment semantics.
- **Data integrity:** good projection model and reconciliation framing, but replay behavior should be tightened to preserve single-chain job lifecycle semantics.

## Priority actions

1. **P0:** Change heartbeat handler to validate session existence/ownership/status synchronously before returning success; return explicit error when not active.
2. **P1:** Refactor replay to either:
   - continue lifecycle in same job row, or
   - mark original row `replayed`/terminal and chain to a child job via `replay_of_job_id` for traceability.
3. **P2:** Align frontend/public stream status types to actual payload (`isLive`, `title`, `viewerCount`, `gameId`) and remove stale `collectionId` field from public contract typing.

## Verdict

**Overall system integrity: GOOD with two targeted correctness gaps (heartbeat acknowledgment semantics and ingest replay lifecycle traceability).**

No broad architectural rewrite is required; focused hardening on the above paths should materially improve operational correctness.
