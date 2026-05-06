<!-- Version: v1.0.0 | Date: 2026-04-15 | Status: Current -->
# Production Environment Verification — Livestream/Broadcast (2026-04-15)

**Version:** v1.0.0
**Verification Date (UTC):** 2026-04-15
**Owner:** APEX Codex
**Scope:** livestream production release evidence

## Verification intent

Validate and timestamp evidence for:

1. production secrets presence,
2. Cloudflare Worker deploy compatibility,
3. Supabase migration readiness for livestream critical path,
4. rollback execution readiness.

## Timestamped evidence log (UTC)

### 1) Cloudflare auth + secrets verification

- `2026-04-15T03:57:34Z` — `npx wrangler whoami`
  - Result: **FAILED** (non-interactive auth missing).
  - Output: `You are not authenticated. Please run wrangler login.`

- `2026-04-15T03:57:36Z` — `npx wrangler secret list`
  - Result: **FAILED** (missing `CLOUDFLARE_API_TOKEN` in environment).
  - Output: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable...`

- `2026-04-15T03:57:37Z` — `npx wrangler secret list --env staging`
  - Result: **NOT EXECUTED** (same authentication blocker as prod command).

### 2) Production route reachability (external probe)

- `2026-04-15T03:58:47Z` — `curl -sS -D - https://sbbl-hq.icu/api/streams/status`
  - Result: **BLOCKED BY EDGE CHALLENGE**.
  - HTTP response included `403 Forbidden` with `cf-mitigated: challenge`.

- `2026-04-15T03:58:48Z` — `curl -sS -D - https://sbbl-hq.icu/api/public-config`
  - Result: **BLOCKED BY EDGE CHALLENGE**.
  - HTTP response included `403 Forbidden` with `cf-mitigated: challenge`.

### 3) Local release gates (completed in-repo)

- `npm ci` — PASS
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm run test` — PASS
- `npm run build` — PASS
- `npx vitest run src/test/worker-stream-hardening.test.ts src/test/live-page-youtube-baseline.test.tsx src/test/live-page-moderation.test.tsx src/test/live-page-camera-only.test.tsx src/test/live-page-secure-path.test.tsx` — PASS

## Blockers that prevent clearing production UNVERIFIED status

1. **Missing Cloudflare API auth in this runtime**: `CLOUDFLARE_API_TOKEN` is not present, and interactive login is unavailable.
2. **Cloudflare anti-bot challenge on production domain** blocks unauthenticated API probes from this environment.
3. **No production Supabase admin credential in session env** (`SUPABASE_SERVICE_ROLE_KEY` absent), preventing live migration-state verification from this runtime.

## Required operator actions to clear blockers

1. Export valid `CLOUDFLARE_API_TOKEN` in this runtime and rerun:
   - `npx wrangler whoami`
   - `npx wrangler secret list`
   - `npx wrangler secret list --env staging`
   - `npx wrangler deployments list`
2. Provide a challenge-exempt verification path (or service-to-service allowlist) for:
   - `GET /api/streams/status`
   - `GET /api/public-config`
3. Provide production Supabase admin access token / service role for migration-state checks:
   - verify all livestream migrations are applied,
   - run read-only sanity query against `stream_admin_config`, `stream_access_sessions`, `stream_chat_messages`, `stream_reactions`.
4. Execute one controlled rollback drill against Cloudflare Worker versions and log the before/after deployment IDs.

## Current conclusion

Production-environment verification is **INCOMPLETE** from this runtime due to hard credential/challenge blockers. Local code quality gates passed, but production evidence remains blocked pending operator credentials and allowlisted verification access.
