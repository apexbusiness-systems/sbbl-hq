# RELEASE READY TRACKER

Date: 2026-04-02 (UTC)
Branch: `work`
Scope in this pass: Phase 1 baseline verification + prioritized execution queue.

## 1) BASELINE STATUS

### Current repo status
- Working tree clean at start of phase.
- No `sbbl-hq-main.zip` file exists in repository; snapshot cannot be diff-verified in this run.

### Verified blockers (code-evidence)
- Production UI mock fallbacks are still present in critical pages (`Stats`, `Leaderboards`, `Store`, `Media`, `Profiles`, `Live`, `Home`, `AppHome`).
- Worker has ack-only handlers on production API routes (`/api/games/:id/stat-sheet`, `/api/streams/:gameId/preview`, `/api/streams/:gameId/session`, `/api/cart/items/:itemId`, `/api/rewards/redeem`).
- Media uploads currently write to `media` bucket in client admin flows and onboarding path; bucket contract reconciliation still required.
- Placeholder marker exists in livestream player implementation (`TODO: Replace YOUR_COLLECTION_ID_HERE...`).

### Baseline command results (exact)
- `npm run lint` → PASS.
- `npm run typecheck` → PASS.
- `npm run build` → PASS.
- `npm run test` → PASS (23 files, 75 tests).
- `npx playwright test` → FAIL (environment: Playwright Chromium missing; requires `npx playwright install`).

### Inventory snapshot (Phase 1)
- Frontend routes (App Router map): `/`, `/league/:leagueId`, `/live`, `/schedules`, `/store`, `/profiles`, `/stats`, `/leaderboards`, `/media`, `/teams`, `/login`, `/onboarding`, `/billing`, `/settings`, `/ops`, `/support`.
- Worker/API critical surfaces include auth/session, public home/products/media, stats/leaderboards RPC, cart/orders/billing, stream access/purchase/config, CSV imports, POTG parse/submit, stripe webhook, ingress/sync.
- Existing contracts to preserve:
  - Route paths in `src/App.tsx` and worker route table.
  - API path contracts used in `src/lib/api/*.ts`.
  - Existing component and hook contracts consumed by pages.
  - Supabase schema + RLS policies in migration chain under `supabase/migrations`.
  - Storage bucket interface currently hard-coded as `media` in upload flows.

## 2) PRIORITIZED TASK QUEUE

### P0 blockers (must close before release)
1. Remove all production UI mock fallbacks in pages and replace with real loading/error/empty states.
2. Replace/close ack-only production routes with persisted behavior or explicit non-production gating.
3. Complete end-to-end admin CRUD persistence for players/teams/products/media/events (UI -> API -> DB/storage -> refresh).
4. Validate and fix storage bucket contract mismatches (including POTG/store/avatar uploads).
5. Verify POTG parse -> validate -> persist path against live schema and relational integrity.
6. Verify/patch server-side validation and auth boundary enforcement for admin mutation routes.
7. Execute DB migration validation on fresh database and capture evidence.
8. Restore Playwright execution environment and add/verify required acceptance flows.

### P1 blockers
1. Strengthen regression coverage around changed contracts (selectors/DOM hooks/route compatibility).
2. Expand smoke checks for deploy integrations (Supabase, Stripe, stream control).
3. Produce final gate verdict with command evidence and rollback notes.

### Execution order
1. Purge UI mock fallbacks.
2. Close backend ack/stub paths and complete CRUD wiring.
3. Security/RLS validation pass.
4. Tests (unit/integration/e2e) + migration smoke.
5. Deploy-readiness verification and final verdict.

## 3) PHASE EXECUTION UPDATE (Current Pass)

### Closed in this pass
- Removed production mock data fallback behavior from `Stats`, `Leaderboards`, `Store`, `Media`, and `Profiles` page data sources; these paths now render explicit loading/error/empty states instead of silently substituting local mock datasets.
- Refactored `Profiles` to source teams/players/leagues from `/api/teams` + league registry rather than `src/data/mock`.

### Still open
- `Live`, `Home`, and `AppHome` still contain mock-bound production data paths and require replacement with live-backed sources.
- Ack-only worker handlers still exist on multiple production routes.
- Storage bucket usage still hardcoded to `media` in upload paths pending bucket contract reconciliation.
- Playwright acceptance remains blocked by missing browser binary in this environment.

### Verification rerun
- `npm run lint` → PASS
- `npm run typecheck` → PASS
- `npm run build` → PASS
- `npm run test` → PASS
- `npx playwright test` → FAIL (Chromium executable missing)

## 4) PHASE EXECUTION UPDATE (Follow-up Pass)

### Closed in this pass
- Removed mock-bound POTG/product feed wiring from `Home`, `AppHome`, and `Live`; these routes now avoid local mock data in production rendering paths.
- Changed worker ack-only mutation handler from fake success to explicit `501 not_implemented` to eliminate false-positive mutation acknowledgements.

### Still open
- Critical operational paths remain unresolved for release readiness:
  - ack routes still need real persistence implementations (currently honest hard-fail)
  - storage bucket contract migration (`media` usage) still pending
  - full admin CRUD parity not fully proven for all required entities
  - fresh DB migration + deployed integration smoke evidence still pending
  - Playwright acceptance still blocked by missing browser binary
