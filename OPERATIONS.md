# SBBL HQ — Operations Runbook

> Last updated: 2026-04-02  
> Owner: APEX Business Systems Ltd

This document is the canonical reference for all operational tasks, deployment procedures, emergency recovery steps, and script/tooling inventory for the SBBL HQ platform.

---

## Table of Contents

1. [Environment & Secrets](#environment--secrets)
2. [Deployment](#deployment)
3. [Database](#database)
4. [Worker Routes Reference](#worker-routes-reference)
5. [Ops Role Matrix](#ops-role-matrix)
6. [Deprecated Scripts — Removal Log](#deprecated-scripts--removal-log)
7. [Emergency Procedures](#emergency-procedures)
8. [Livestream Ops](#livestream-ops)
9. [CI/CD Notes](#cicd-notes)

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
| `OMNIHUB_SIGNING_SECRET` | OmniHub sync packet signing secret |
| `OMNIHUB_SYNC_URL` | OmniHub outbound sync endpoint |
| `GROQ_API_KEY` | Groq API key for POTG image parsing |

Client-side env vars (Vite build-time, set as GitHub Actions secrets):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client SDK init) |

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

Worker is deployed as part of the same Cloudflare Pages project (see `wrangler.jsonc`). The worker entry is `src/worker/index.ts`.

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

### Row-Level Security

All non-public tables have RLS enabled. The service role key (worker only) bypasses RLS. Never expose the service role key to the client.

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

## Deprecated Scripts — Removal Log

The following one-off scripts were deleted from the repo root as part of the PR #77 cleanup. They were **not** referenced in `package.json` scripts, CI workflows, or any runbook at time of deletion. No production functionality depended on them.

### `fixidempotency.cjs`

- **What it did:** One-off script to backfill missing `idempotency_key` values on existing DB rows after the idempotency system was first introduced.
- **Status:** Backfill is complete. All new rows have idempotency keys enforced at insert time by the worker.
- **Replacement:** No replacement needed. If a future backfill is required, create a versioned Supabase migration under `supabase/migrations/` with a SQL `UPDATE` statement.

### `generate-teams.cjs`

- **What it did:** One-off script to seed initial team records during early development.
- **Status:** Teams are now managed via `POST /ops/imports/teams` (worker route, auth-gated, audit-logged, import-job tracked).
- **Replacement:** Use the Ops Console import flow (`/ops` → Import → Teams) or call `POST /ops/imports/teams` with a JSON payload of team rows. See worker route for required fields: `league_id`, `season_id`, `division_id`, `name`.

### `updatevite.cjs`

- **What it did:** One-off script to patch Vite config during an early dependency migration.
- **Status:** Vite config is stable. `vite.config.ts` is the canonical config file.
- **Replacement:** No replacement needed. Any future Vite config changes go directly in `vite.config.ts` via a normal PR.

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

1. Open Cloudflare Dashboard → Workers & Pages → `sbbl-hq`
2. Click Deployments → find the last known-good deployment
3. Click "Rollback to this deployment"

Or via CLI:

```bash
# Redeploy a specific git commit
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

This sets `is_live = false` in `stream_admin_config`, stamps `live_ended_at`, and inserts an `ended` row in `stream_sessions`. All active viewers will see the offline state on next poll.

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
[Has access] → POST /api/streams/:gameId/session (auth) → short-lived playback descriptor + session id
    ↓
Client heartbeat → POST /api/streams/:gameId/session/heartbeat every ~25s
    ↓
Client teardown → POST /api/streams/:gameId/session/end
    ↓
Stripe webhook → create_stream_entitlement RPC (24h window)
```

### Collection ID

The `collection_id` (Cloudflare Stream collection or equivalent embed ID) is stored in `stream_admin_config` and returned only via authenticated ops routes (`GET /ops/streams/config`). Public `GET /api/streams/status` does not include playback source fields.

### Viewer count

Viewer count is derived from active playback presence: distinct `user_id` rows in `stream_access_sessions` where `status='active'` and `expires_at > now()`, scoped by `game_id`. It is included in `GET /api/streams/status` as `viewerCount`.

### Chat/comments model

- `GET /api/streams/:gameId/comments` returns recent active comments for the live room.
- `POST /api/streams/:gameId/comments` writes authenticated comments with message length validation.
- Comments are persisted in `stream_chat_messages` with moderation statuses: `active`, `hidden`, `removed`.

### Anti-abuse controls

- Purchase entry and invite redemption support Turnstile verification when `OPTIONAL_TURNSTILE_SECRET_KEY` is configured.
- Worker-side in-memory rate limiting protects:
  - stream purchase starts
  - invite redemption attempts
  - live chat posting bursts

---

## CI/CD Notes

- CI runs on push to `main`, `staging`, `release/**` and on PRs targeting `main`/`staging`
- Steps: lint → typecheck → unit/integration tests → build
- E2E (Playwright) runs after the quality gate but currently has `continue-on-error: true` — **this must be changed to blocking before the next production release**
- Cloudflare Pages auto-deploys on merge to `main`
- Supabase preview branches are NOT auto-created for PRs that do not modify `supabase/` directory

### Making E2E blocking

In `.github/workflows/ci.yml`, change the `e2e` job:

```yaml
# Before (non-blocking)
continue-on-error: true

# After (blocking — required for production)
# Remove the continue-on-error line entirely, or set:
continue-on-error: false
```

Also add `e2e` to the required status checks in the branch protection rule for `main`.
