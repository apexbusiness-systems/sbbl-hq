# SBBL Architecture (Cloudflare + Supabase)

## Runtime Topology
- **Edge API runtime:** Cloudflare Worker at `src/worker/index.ts`.
- **Frontend runtime:** Cloudflare Pages static assets through `env.ASSETS.fetch(req)` fallback in the Worker.
- **Database/auth:** Supabase Postgres + Supabase Auth via `@supabase/supabase-js`.

## Frontend Boot Sequence
1. `index.html` loads → React app mounts.
2. `AuthContext` calls `initSupabaseClient()` which fetches `/api/public-config` from the Worker.
3. Runtime config cached in memory; Supabase client created with fetched URL + publishable key.
4. Fallback: if `/api/public-config` unreachable (local dev), uses `import.meta.env.VITE_SUPABASE_URL` etc.
5. `AuthContext` exposes `configAvailable` boolean for graceful degradation when config unavailable.

**Key files:** `src/lib/runtime-config.ts`, `src/lib/supabase/client.ts`, `src/contexts/AuthContext.tsx`

## Canonical League Model
Single source of truth: `src/lib/leagues.ts`
- `LEAGUE_CONFIGS[]` — id, code, name, tagline, color for SBBL, WBL, TGIFBL
- Helpers: `getLeagueConfig()`, `leagueIdFromCode()`, `persistLeague()`, `loadPersistedLeague()`
- Consumed by: `AppContext`, `Header`, `LeagueBadge`, `Home`, `Login`

## Request Lifecycle
1. Worker validates required environment via `safeServerEnv`.
2. **Public routes** (`/api/public-config`, `/api/public/home`) skip auth and return shaped DTOs.
3. **Authenticated routes**: Worker resolves user session from bearer token (`supabase.auth.getUser`) or fallback headers.
4. Route matching is done from explicit route table (`method + regex` compiled from static path patterns).
5. Handlers call either:
   - RPC functions (`get_stats_dashboard`, `get_leaderboards`, `save_stat_draft`, `finalize_game_stats`), or
   - mutation acknowledgment path with idempotency recording (`api_idempotency_keys`).
6. Unmatched requests pass to static asset handler (`ASSETS`) and then return 404 JSON for missing routes.

## Service Boundaries
Current implementation is centralized in `src/worker/index.ts`. Route/logic/repo layering is not yet split into `/routes`, `/services`, `/repos` folders.

## Auth, Roles, and Access Control
- Auth source: Supabase JWT (`Authorization: Bearer ...`) when publishable key exists.
- Fallback identity: `x-sbbl-user-id` header (used for non-JWT flows/tests).
- Role parsing: `x-sbbl-roles` comma-separated header; default role is `fan` when absent.
- Ops authorization uses `canAccessOps(...)` to gate `/ops/*` endpoints.
- Write idempotency enforced on mutating methods through `readIdempotencyKey(...)` + insert into `api_idempotency_keys`.

## Data Layer
- Admin DB client uses Supabase service role key in Worker context.
- Data access patterns in current Worker:
  - RPC reads: stats + leaderboards.
  - RPC writes: game draft + finalize.
  - Table insert: `api_idempotency_keys`.

## Reliability & Error Handling
- Explicit JSON error responses used at route dispatch boundary:
  - `401` unauthorized
  - `400` idempotency key errors
  - `500` internal or misconfiguration errors
  - `404` not found
- Duplicate idempotency-key fallback protection uses in-memory transient map for 5 minutes.

## Environment Variables
- Required:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
- Optional:
  - `SUPABASE_PUBLISHABLE_KEY`
  - `OPTIONAL_SOCIAL_API_KEYS`
  - `OPTIONAL_TURNSTILE_SECRET_KEY`
- Asset binding:
  - `ASSETS`

## Deployment Configuration
- Worker entrypoint: `src/worker/index.ts`.
- Compatibility date: `2026-03-27`.
- Worker-first routing for `/api/*`, `/auth/*`, `/webhooks/*`, `/ops/*`.
- Staging env configured as `sbbl-hq-staging`.

## Observability and Queue Posture (Current State)
- Structured logging, metrics, alerts, and queue consumers are not yet declared in the Worker source.
- Cloudflare Queue bindings for `media-processing`, `notifications`, and `stats-aggregation` are not currently present in `wrangler.jsonc`.
