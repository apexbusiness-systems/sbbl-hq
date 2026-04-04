<!-- Version: v1.3.0 | Date: 2026-04-04 | Status: Current -->
# SBBL HQ — Operations Runbook

> Last updated: 2026-04-04
> Owner: APEX Business Systems Ltd

This document is the canonical reference for all operational tasks, deployment procedures, emergency recovery steps, and script/tooling inventory for the SBBL HQ platform.

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
  └── Currently non-blocking — must be made blocking before production release

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

Same endpoint, `"action": "grant"`. The entitlement is created with the standard 24-hour window.

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

### Stream flow

```
Switcher Studio (RTMP) → Cloudflare Stream / embed source
    ↓
Ops sets isLive=true via POST /ops/streams/status (super_admin)
    ↓
App polls GET /api/streams/status → { isLive: true, gameId }
    ↓
User hits GET /api/streams/:gameId/access → can_user_view_stream RPC
    ↓
[No access] → Paywall gate → POST /api/streams/:gameId/purchase → Stripe Checkout
[Has access] → POST /api/streams/:gameId/session → playback descriptor + session id
    ↓
Client heartbeat → POST /api/streams/:gameId/session/heartbeat every ~25s
    ↓
Client teardown → POST /api/streams/:gameId/session/end
    ↓
Stripe webhook → Worker POST /webhooks/stripe → create_stream_entitlement RPC (24h window)
```

### Collection ID

The `collection_id` (Cloudflare Stream collection or equivalent embed ID) is stored in `stream_admin_config` and returned only via authenticated ops routes (`GET /ops/streams/config`). Public `GET /api/streams/status` does not include playback source fields.

### Viewer count

Viewer count is derived from active playback presence: distinct `user_id` rows in `stream_access_sessions` where `status='active'` and `expires_at > now()`, scoped by `game_id`. It is included in `GET /api/streams/status` as `viewerCount`.

### Chat/comments model

- `GET /api/streams/:gameId/comments` returns recent active comments for the live room.
- `POST /api/streams/:gameId/comments` writes authenticated comments with message length validation (1–400 chars).
- Comments are persisted in `stream_chat_messages` with moderation statuses: `active`, `hidden`, `removed`.

### Anti-abuse controls

- Purchase entry and invite redemption support Turnstile verification via `useTurnstile` hook (client) and `verifyTurnstileToken()` (worker) when `OPTIONAL_TURNSTILE_SECRET_KEY` is configured.
- Worker-side in-memory rate limiting protects: stream purchase starts, invite redemption attempts, live chat posting bursts.
