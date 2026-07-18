# Correction: CORS Port Mismatch & wrangler.jsonc CI Guardrail

- **Date:** 2026-07-18
- **Scope:** Project-wide
- **Affected Pages:** `CLAUDE.md`, `CHANGELOG.md`, `docs/CHANGELOG.md`, `docs/README.md`
- **Promotion Decision:** User-pattern rule & core directive

## Original Assumptions vs. Corrected State

### 1. CORS Allowed Origins Port Mismatch
- **Original Assumption:** Whitelisting `http://localhost:5173` was sufficient for local development, as it is the default port for Vite.
- **Corrected State:** The Vite dev server is configured to run on port `8080` in [vite.config.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/vite.config.ts). Strict browsers (like Google Chrome) reject preflight `OPTIONS` requests from `http://localhost:8080` if the port is not explicitly whitelisted. Both [src/worker/index.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/src/worker/index.ts) and [src/api-proxy-worker/index.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/src/api-proxy-worker/index.ts) must whitelist `http://localhost:8080` in `ALLOWED_ORIGINS`.

### 2. Wrangler Config Guardrail and Credential Separation
- **Original Assumption:** Committing the real `SUPABASE_PUBLISHABLE_KEY` in `wrangler.jsonc` was acceptable to make local development work.
- **Corrected State:** Committing any real hosted Supabase JWT anon keys to `wrangler.jsonc` triggers a failure in the Vitest security guardrail check (`must not commit hosted Supabase JWT fallback keys` in [src/test/wrangler-config-guard.test.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/src/test/wrangler-config-guard.test.ts)). To keep CI green and allow local dev to function:
  1. `SUPABASE_PUBLISHABLE_KEY` in `wrangler.jsonc` must remain set to its placeholder `"replace-with-supabase-anon-key"`.
  2. Developers must use a local, git-ignored `.dev.vars` file in the project root to bind the real credentials (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`) at runtime.
