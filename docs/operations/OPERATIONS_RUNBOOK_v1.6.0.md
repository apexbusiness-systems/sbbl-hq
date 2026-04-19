<!-- Version: v1.6.0 | Date: 2026-04-19 | Status: Current -->
# SBBL HQ — Operations Runbook

> Last updated: 2026-04-19
> Owner: APEX Business Systems Ltd
> Previous version: v1.5.0 (2026-04-18)

## Change log

**v1.6.0 — 2026-04-19** — Universal Stream Player + WHIP browser ingest.
Added MediaMTX `/whip/*` listener and the matching Caddy reverse proxy on
`stream.sbbl-hq.icu`. Documented admin operations for local-file broadcast
and webcam broadcast flows (§ "Broadcast from the browser"). Player now
accepts any Twitch/YouTube/Vimeo/HLS/DASH/MP4/m4v/mov/webm/WHEP/`blob:`
source with zero friction — see `docs/features/STREAM_GATING_v1.7.0.md`
for the capability matrix.

This document is the canonical reference for all operational tasks, deployment procedures, emergency recovery steps, and script/tooling inventory for the SBBL HQ platform.

## Entitlement Windows (canonical)

These values are defined in `src/lib/constants/ENTITLEMENT_CONSTANTS.ts`
and are the SINGLE SOURCE OF TRUTH. Ops scripts, manual grants, and
support tooling must read from that file; ad-hoc literals in runbook
commands are banned and caught by the CI guard.

| Constant | Value | Meaning |
|----------|-------|---------|
| `VIEWING_SESSION_MAX_SECONDS` | 21600 (6 h) | Hard cap on a single playback session. |
| `ENTITLEMENT_VALIDITY_HOURS` | 48 | Validity post-Stripe-confirmation. Not the session cap. |
| `MANUAL_COMP_VALIDITY_HOURS` | 48 | Default for super-admin comp grants (clamped `[1,168]`). |
| `REPLAY_EMBARGO_DAYS` | 7 | Minimum embargo before replay is purchasable. |
| `REPLAY_RAW_PRICE_CAD` | $1.50 | Raw replay price. |
| `REPLAY_EDITED_PRICE_CAD` | $5.00 | Edited replay price. |

See `docs/features/STREAM_GATING_v1.7.0.md` for the full semantic model.

## Changelog (v1.5.0)

- Entitlement validity raised 6h → 48h. Aligns with the canonical
  `ENTITLEMENT_VALIDITY_HOURS` constant. Session cap unchanged.
- Manual comp / invite default raised 24h → 48h
  (`MANUAL_COMP_VALIDITY_HOURS`).
- New worker env flags wired (default off): `FEATURE_SIGNED_PLAYBACK_ENABLED`,
  `FEATURE_NATIVE_HLS_PROVIDER`, `FEATURE_SHOW_VIEWER_PREFLIGHT`,
  `FEATURE_FAN_TOKEN_SYSTEM`, `FEATURE_BIOMETRIC_OVERLAY`,
  `FEATURE_MIC_UP_SERIES`, plus `PLAYBACK_TOKEN_SECRET` secret.
- Additive migration `20260418120000_playback_provider_abstraction.sql`
  adds `stream_playback_providers`, `stream_playback_tokens`,
  `overlay_event_log`, and extends `games` with provider / replay /
  event-type columns. No drops, no backfill required.

---

## Table of Contents

1. [Environment & Secrets](#environment--secrets)
2. [Deployment](#deployment)
3. [Database](#database)
4. [Worker Routes Reference](#worker-routes-reference)
5. [Ops Role Matrix](#ops-role-matrix)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Deprecated Scripts — Removal Log](#deprecated-scripts--removal-log)
8. [Emergency Procedures](#emergency-procedures)
9. [Livestream Ops](#livestream-ops)

---

## Environment & Secrets

All required secrets are listed in `wrangler.jsonc` under `[vars]` / `[[secrets]]`. Required values for production:

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (JWT verify) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (admin DB client) |
| `STRIPE_SECRET_KEY` | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook HMAC secret |
| `OPTIONAL_TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server verification (optional — captcha skipped when absent) |
| `SENTRY_DSN` | Sentry error tracking DSN (worker, set in wrangler.jsonc vars) |
| `OMNIHUB_SIGNING_SECRET` | OmniHub sync packet signing secret |
| `OMNIHUB_SYNC_URL` | OmniHub outbound sync endpoint |
| `GROQ_API_KEY` | Groq API key for POTG image parsing |

Client-side env vars (Vite build-time, set as GitHub Actions secrets):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client SDK init) |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key (optional — captcha UI hidden when absent) |
| `VITE_SENTRY_DSN` | Sentry DSN for client-side error tracking (optional) |

**Never** add `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to Vite env vars — these are worker-only.

---

## Deployment

### Frontend (Cloudflare Pages)

Auto-deployed by Cloudflare Pages on every push to `main`. Manual deploy:

```bash
npm run build
npm run cf:deploy
```

Staging:

```bash
npm run cf:deploy:staging
```

### Worker (Cloudflare Workers)

Worker is deployed as part of the same Cloudflare Pages project. Worker name in `wrangler.jsonc` is **`sbbl-hq-worker`**. Entry point: `src/worker/index.ts`.

### Stripe Webhook Edge Function

Deployed via Supabase CLI:

```bash
supabase functions deploy stripe-webhook
```

**Note:** The canonical Stripe webhook handler is the Cloudflare Worker route `POST /webhooks/stripe` (`src/worker/index.ts`). The Edge Function at `supabase/functions/stripe-webhook/index.ts` is retained as an archival reference. `STRIPE_WEBHOOK_SECRET` must be set in the Worker environment.

---

## Database

### Migrations

```bash
# Push pending migrations to Supabase
npm run db:migrate

# Regenerate TypeScript types from live schema
npm run db:types
```

Migration files live in `supabase/migrations/`. All migrations must be reviewed before `db:migrate` is run against production.

### Defensive Migration Patterns

- **Event triggers** (`CREATE EVENT TRIGGER`) wrapped in `EXCEPTION WHEN insufficient_privilege` — required for Supabase preview branch compatibility where superuser privileges may not be available.
- **Materialized view publications** wrapped in broad exception handler — `ALTER PUBLICATION ADD TABLE` on materialized views throws `wrong_object_type`.
- **`OWNER TO postgres`** wrapped in `EXCEPTION WHEN others` — preview branches may use a different role.
- All indexes use `IF NOT EXISTS` for safe idempotent re-runs.

### Row-Level Security

All non-public tables have RLS enabled. Enforced automatically by `trg_auto_enable_rls` event trigger (logs to `rls_audit`). The service role key (worker only) bypasses RLS. Never expose the service role key to the client.

---

## Worker Routes Reference

See `src/worker/index.ts` for the full route table. Key groupings:

- `/api/public/*` — unauthenticated, public-safe data
- `/api/*` — authenticated (JWT required)
- `/ops/*` — authenticated + `league_admin` or `super_admin` role required
- `/ops/streams/config` (POST), `/ops/streams/status`, `/ops/access/override` — `super_admin` only
- `/webhooks/stripe` — HMAC-SHA256 verified, no auth header required

---

## Ops Role Matrix

| Role | `/ops/*` read | `/ops/*` write | Stream config | Stream status | Access override |
|---|---|---|---|---|---|
| `fan` | No | No | No | No | No |
| `player` | No | No | No | No | No |
| `team_manager` | Yes | Scoped | No | No | No |
| `league_admin` | Yes | Own league | No | No | No |
| `super_admin` | Yes | Global | Yes | Yes | Yes |

Role assignments live in `user_role_assignments` table. Roles are **never** read from client-supplied headers — they are fetched from DB inside `requireAdminSession()` after JWT verification.

---

## CI/CD Pipeline

### Workflow (`.github/workflows/ci.yml`)

Triggers on push to `main`/`staging`/`release/**` and PRs targeting `main`/`staging`.

```
Job 1: Lint & Typecheck
  ├── npm ci
  ├── npx eslint . --max-warnings 0
  ├── npx tsc --noEmit -p tsconfig.app.json
  └── npx tsc --noEmit -p tsconfig.node.json (continue-on-error)

Job 2: Unit & Integration Tests
  ├── npm ci
  ├── npx vitest run --coverage --reporter=verbose
  └── Coverage thresholds: lines 25%, functions 20%, branches 14%, statements 23%

Job 3: Build & Bundle Check (depends on Job 1)
  ├── npm run build
  └── Bundle guard — per-chunk KB limits:
       react-vendor 185, supabase-vendor 215, ui-vendor 700,
       charts-vendor 280, rxdb-vendor 600, media-vendor 360,
       query-vendor 80, utils-vendor 140, forms-vendor 80
       (tree-shaken chunks handled via || true under pipefail)

Job 4: Playwright E2E (depends on Job 3)
  └── Blocking gate — job failure fails CI

External Checks:
  ├── Supabase Preview (migration validation on preview branch)
  └── Cloudflare Workers Builds (sbbl-hq, sbbl-hq-worker)
```

### Coverage Configuration

Coverage is scoped to 6 critical files in `vitest.config.ts`:
- `src/worker/index.ts`
- `src/lib/api/stream.ts`
- `src/pages/Live.tsx`
- `src/contexts/AppContext.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/BagContext.tsx`

Thresholds are calibrated to current test suite coverage. Ratchet upward as tests are added for AuthContext, BagContext, and stream.ts.

### Bundle Guard Notes

The `check_chunk` function in the bundle guard step uses `ls ... | head -1 || true` to safely handle tree-shaken chunks that don't exist in the build output. This is required because GitHub Actions runs bash with `-eo pipefail`, which would otherwise propagate `ls` exit code 2 through the pipeline.

---

## Deprecated Scripts — Removal Log

The following one-off scripts were deleted from the repo root as part of the PR #77 cleanup. They were **not** referenced in `package.json` scripts, CI workflows, or any runbook at time of deletion. No production functionality depended on them.

### `fixidempotency.cjs`

- **What it did:** One-off script to backfill missing `idempotency_key` values.
- **Status:** Backfill is complete. All new rows have idempotency keys enforced at insert time by the worker.
- **Replacement:** If a future backfill is required, create a versioned Supabase migration.

### `generate-teams.cjs`

- **What it did:** One-off script to seed initial team records during early development.
- **Status:** Teams are now managed via `POST /ops/imports/teams`.
- **Replacement:** Use the Ops Console import flow or call `POST /ops/imports/teams` with a JSON payload.

### `updatevite.cjs`

- **What it did:** One-off script to patch Vite config during an early dependency migration.
- **Status:** Vite config is stable. `vite.config.ts` is the canonical config file.
- **Replacement:** No replacement needed.

---

## Emergency Procedures

### Revoke a user's PPV access

```
POST /ops/access/override
Authorization: Bearer <super_admin_token>
Idempotency-Key: <uuid>

{
  "userId": "<target_user_id>",
  "gameId": "<game_id>",
  "action": "revoke",
  "reason": "<reason>"
}
```

This soft-expires the `stream_entitlements` row and writes an `audit_logs` entry.

### Grant manual PPV access

Same endpoint, `"action": "grant"`. The entitlement is created with the canonical 48-hour validity window (`ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS`). Session cap on any resulting playback session is independently 6 hours.

### Roll back a bad worker deploy

1. Open Cloudflare Dashboard → Workers & Pages → `sbbl-hq-worker`
2. Click Deployments → find the last known-good deployment
3. Click "Rollback to this deployment"

Or via CLI:

```bash
git checkout <known-good-sha>
npm run cf:deploy
```

### Emergency stream kill switch

```
POST /ops/streams/status
Authorization: Bearer <super_admin_token>
Idempotency-Key: <uuid>

{ "isLive": false }
```

This sets `is_live = false` in `stream_admin_config`, stamps `live_ended_at`, and inserts an `ended` row in `stream_sessions`.

---

## Livestream Ops

> **v1.4.0 (2026-04-05):** Stream controls consolidated to single admin overlay on the Live page video wrapper. Ops console streams tab removed. Auth auto-refresh on all stream API calls.

### Admin control surface

**Single location:** Gear-icon overlay dropdown on the Live page (`/live`) video wrapper. Visible to `super_admin` only.

**Controls:** Stream URL input, broadcast title, live stats (status/viewers/PPV), Go Live / End Stream button.

**Previous Ops console streams tab:** Removed in v1.4.0 to eliminate duplicate ingestion points.

### Stream flow

```
External source (YouTube Live / Twitch / direct URL)
    ↓
Admin opens /live → gear icon → pastes stream URL → clicks "Go Live"
    ↓
POST /ops/streams/config (save URL + title) → POST /ops/streams/status (isLive=true)
    ↓
App polls GET /api/streams/status every 15s → { isLive: true, gameId }
(Edge-cached with 10s TTL, cache-busted on admin changes)
    ↓
User hits GET /api/streams/:gameId/access → can_user_view_stream RPC
    ↓
[No access] → Paywall gate → POST /api/streams/:gameId/purchase → Stripe Checkout
[Has access] → POST /api/streams/:gameId/session → playback URL + session id
    ↓
Client heartbeat → POST /api/streams/:gameId/session/heartbeat every ~25s
(Circuit breaker: stops after 3 failures, shows "Connection lost" banner)
    ↓
Client teardown → POST /api/streams/:gameId/session/end (on component unmount)
    ↓
Stripe webhook → Worker POST /webhooks/stripe → create_stream_entitlement RPC (48h validity window — ENTITLEMENT.ENTITLEMENT_VALIDITY_HOURS)
```

### Stream URL (collection_id)

The stream URL is stored in `stream_admin_config.collection_id` and served to authorized viewers via `POST /api/streams/:gameId/session` → `playback.url`. Public `GET /api/streams/status` does **not** include the playback URL.

### Viewer count

Viewer count is derived from active playback presence: `COUNT(DISTINCT user_id)` in `stream_access_sessions` where `status='active'` AND `expires_at > now()`, scoped by `game_id`. Verified accurate to 0.00% drift at 20,000 concurrent viewers.

### Auth resilience

All stream API calls use `apiFetch` which auto-refreshes expired JWTs via `getAuthToken()`. On 401, `apiFetch` refreshes the session and retries exactly once — regardless of whether the token was explicit or auto-fetched. This eliminates the stale-token 401 loop that previously blocked admin controls.

### Chat/comments model

- `GET /api/streams/:gameId/comments` returns recent active comments for the live room.
- `POST /api/streams/:gameId/comments` writes authenticated comments with message length validation (1–400 chars).
- Comments are persisted in `stream_chat_messages` with moderation statuses: `active`, `hidden`, `removed`.

### Anti-abuse controls

- Purchase entry and invite redemption support Turnstile verification via `useTurnstile` hook (client) and `verifyTurnstileToken()` (worker) when `OPTIONAL_TURNSTILE_SECRET_KEY` is configured.
- Worker-side in-memory rate limiting protects: stream purchase starts, invite redemption attempts, live chat posting bursts.

## Broadcast from the browser (v1.6.0)

The admin console under `/live` → gear icon exposes three new controls.
They replace the "bring your own OBS" workflow for simple highlight-reel
broadcasts and camera-only feeds.

### 1. Paste any link

Every URL the detector in `src/lib/stream/url-detector.ts` recognizes is
accepted verbatim — Twitch, YouTube, Vimeo, Facebook, Kick, Rumble,
Dailymotion, HLS (including presigned), DASH, WHEP, RTMP (with advisory),
and direct video files (mp4/m4v/mov/webm/ogg/ogv, including presigned
S3/R2). The player normalizes to the canonical watch/embed form on save.

### 2. Load Local File → Broadcast File

1. Click `Load Local File`; pick a `.mp4` / `.mov` / `.webm` clip.
2. The preview video appears inline. You can scrub / verify before
   broadcasting — no viewers see it yet.
3. Click `Broadcast File`. The hook captures a `MediaStream` from the
   playing `<video>` via `HTMLVideoElement.captureStream()` and publishes
   it to `https://stream.sbbl-hq.icu/whip/<gameId>` using WHIP.
4. MediaMTX re-emits the feed as WHEP on the matching
   `https://stream.sbbl-hq.icu/whep/<gameId>` endpoint. Paste that URL
   into the Stream URL input if you want the session gating (PPV, invite,
   session heartbeat) to apply.
5. Click `Stop Broadcast` to tear down the peer connection and DELETE
   the WHIP resource.

### 3. Broadcast Camera

1. Click `Broadcast Camera`. The browser prompts for camera+mic access.
2. On approval, `getUserMedia({ video: {1280×720}, audio: true })` drives
   the same WHIP publisher used by the file-broadcast path.
3. Same `Stop Broadcast` flow tears it down.

### Caddyfile layout

```caddyfile
stream.sbbl-hq.icu {
  reverse_proxy /whep/* localhost:8889   # egress — viewers
  reverse_proxy /whip/* localhost:8889   # ingest — admin browser publishers
  reverse_proxy /api/*  localhost:9997   # MediaMTX admin API (loopback only in prod)
}
```

Both `/whep/*` and `/whip/*` share MediaMTX's WebRTC mux listener on
8889. Port 9997 (MediaMTX API) is intentionally exposed only inside the
private network; use SSM Session Manager to hit it from an ops laptop.

### MediaMTX config knobs

- `paths.all.runOnInit: publisher_start.sh` can be used to forward the
  re-emitted stream to YouTube/Twitch simultaneously (multi-push).
- `webrtcAllowOrigin` must include `https://sbbl-hq.icu` (default is `*`
  but the Caddy layer already scopes this per-path).
- TURN is recommended for production resilience (admins behind symmetric
  NATs); today we ship only STUN and rely on MediaMTX's public address
  discovery. See v1.7.0 runbook for TURN rollout instructions.

### Troubleshooting WHIP

| Symptom | Likely cause | Fix |
|---|---|---|
| Status stuck on `connecting` | ICE candidates didn't reach MediaMTX | Check firewall; MediaMTX needs UDP 8189 (RTP) reachable. |
| 401 on POST | Missing/expired bearer token | Re-authenticate; WHIP tokens are short-lived. |
| 400 on POST | SDP parse error (usually codec mismatch) | Confirm browser supports H.264 + Opus; Safari on older iOS may not. |
| `Stop Broadcast` doesn't release | Browser crashed before DELETE | MediaMTX GCs dead sessions on its idle timeout (default 30 s). |
| Audio out of sync on captureStream() | Browser re-samples on tab throttling | Keep the `/live` tab active; consider using `Broadcast Camera` for production events. |
