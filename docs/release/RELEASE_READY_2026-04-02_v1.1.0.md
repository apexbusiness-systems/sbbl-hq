# SBBL-HQ Release Readiness Report

- **Document ID:** RELEASE_READY_2026-04-02_v1.1.0
- **Date (UTC):** 2026-04-02
- **Prepared by:** Codex delivery pass
- **Scope:** Conversation execution recap + ship-gate evidence
- **Current verdict:** **NOT READY**

## 1. Scope Recap (Conversation Diff Summary)

### Frontend wiring and fallback removals
- Replaced production mock fallbacks and mock imports with API-backed queries and explicit loading/error/empty UX states in:
  - `src/pages/AppHome.tsx`
  - `src/pages/Home.tsx`
  - `src/pages/Live.tsx`
  - `src/pages/Leaderboards.tsx`
  - `src/pages/Media.tsx`
  - `src/pages/Profiles.tsx`
  - `src/pages/Stats.tsx`
  - `src/pages/Store.tsx`

### Backend worker route closure
- Replaced ack-only placeholder routing with concrete handlers for:
  - `GET /api/games/:id/stat-sheet`
  - `GET /api/streams/:gameId/preview`
  - `POST /api/streams/:gameId/session`
  - `DELETE /api/cart/items/:itemId`
  - `POST /api/rewards/redeem`
- Added auth/idempotency/ownership checks and operational DB reads/writes for these paths.

### Test coverage additions
- Added `src/test/worker-persistence-routes.test.ts` to validate:
  - stat-sheet read path
  - stream session creation path
  - reward redemption persistence
  - ownership-gated cart item deletion

### Environment unblocking actions
- Installed Playwright browser runtime + missing Linux shared libraries.
- Updated `package.json` migration command to `npx supabase db push` to remove PATH coupling.

## 2. Verification Evidence

### Quality gates
- `npm run lint` ✅ PASS
- `npm run typecheck` ✅ PASS
- `npm run test` ✅ PASS (24 files, 78 tests)
- `npm run build` ✅ PASS

### E2E acceptance
- `npx playwright test` ✅ PASS (8/8)

### Migration/deploy checks
- `npm run db:migrate` ⚠️ BLOCKED — Supabase CLI now runs but project is not linked (`Cannot find project ref. Have you run supabase link?`).
- Deploy smoke (Vercel/Supabase/Stripe) ⚠️ UNVERIFIED — credentials/bindings unavailable in this environment.

## 3. Gate Matrix (Ship Criteria)

| Gate | Status | Evidence |
|---|---|---|
| Lint | PASS | command output in run log |
| Typecheck | PASS | command output in run log |
| Build | PASS | command output in run log |
| Unit/integration tests | PASS | 24 files / 78 tests |
| E2E tests | PASS | Playwright 8/8 |
| Fresh DB migration | BLOCKED | Supabase project link missing |
| Deploy smoke with real integrations | BLOCKED | credentials/bindings missing |

## 4. Operational Risks Remaining
- Fresh DB migration has not been executed against a linked target project.
- Production integration smoke for Supabase/Stripe/deploy paths is not yet evidenced.

## 5. Final Release Decision
- **Release status: NOT READY**
- **Reason:** Ship gates requiring linked DB migration proof and deploy integration smoke are unproven in this environment.

## 6. Required Next Actions
1. Link/authenticate Supabase project (`supabase link`) and execute `npm run db:migrate`.
2. Run post-migration smoke in target environment (auth, CRUD, stream access, reward redeem, uploads).
3. Run deploy smoke with production-like bindings for Supabase/Stripe and capture logs.
4. Publish a new report revision with completed migration/deploy evidence.
