# SBBL-HQ Release Readiness Report

- **Document ID:** RELEASE_READY_2026-04-02_v1.2.0
- **Date (UTC):** 2026-04-02
- **Version:** v1.2.0
- **Prepared by:** Codex delivery pass
- **Current verdict:** **NOT READY**

## Executive Summary
This pass closed major application-level blockers (mock fallbacks, ack-only worker routes) and achieved passing lint/typecheck/build/unit+integration/e2e gates. Final release remains blocked by unproven fresh DB migration and deploy smoke due missing Supabase project linking/credentials in this environment.

## Conversation Recap (Diff Scope)

### UI and data wiring
- Removed production mock fallback usage across: `AppHome`, `Home`, `Live`, `Leaderboards`, `Media`, `Profiles`, `Stats`, `Store`.
- Added explicit loading/error/empty states for API-backed rendering.

### Worker backend closure
- Implemented real handlers and route wiring for:
  - `GET /api/games/:id/stat-sheet`
  - `GET /api/streams/:gameId/preview`
  - `POST /api/streams/:gameId/session`
  - `DELETE /api/cart/items/:itemId`
  - `POST /api/rewards/redeem`
- Added auth/idempotency/ownership validations in these handlers.

### Test expansion
- Added `src/test/worker-persistence-routes.test.ts` with mocked Supabase persistence assertions.

### Environment unblock work
- Installed required Linux runtime libraries for Playwright.
- Installed Playwright Chromium runtime.
- Updated migration script to `npx supabase db push`.

## Verification Matrix

| Gate | Status | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| build | PASS | `npm run build` |
| unit/integration tests | PASS | `npm run test` (24 files / 78 tests) |
| e2e | PASS | `npx playwright test` (8/8) |
| fresh DB migration | BLOCKED | `npm run db:migrate` → project ref/link missing |
| deploy smoke (Supabase/Stripe/Vercel) | BLOCKED | credentials/bindings unavailable |

## Blocking Evidence
- `npm run db:migrate` reaches Supabase CLI but fails with:
  - `Cannot find project ref. Have you run supabase link?`
- Deploy/integration smoke not executable in this environment without authenticated project bindings.

## Final Decision
- **Release status:** **NOT READY**
- **Reason:** migration + deploy integration gates remain unproven.

## Required Next Actions
1. Run `supabase link` with target project credentials.
2. Execute `npm run db:migrate` against linked project and capture logs.
3. Execute deploy smoke for Supabase/Stripe/Vercel integrations.
4. Publish v1.2.1 report with migration/deploy proof to re-evaluate READY verdict.
