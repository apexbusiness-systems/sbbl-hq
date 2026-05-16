# Owner Live + Self-Host Auth — Clean Consolidation Evidence

## Branch

`fix/owner-selfhost-auth-live-ingest-clean` — supersedes PR #514 and PR #515.

## Cherry-picked commits (from PR #514)

| Order | SHA (original) | Subject |
|---|---|---|
| 1 | `b1f6d17` | Auto-fix applied by CodeX: add owner selfhost evidence |
| 2 | `43e3ec7` | Auto-fix applied by CodeX: repair realtime schema bootstrap |
| 3 | `4bcbe5e` | Auto-fix applied by CodeX: repair Store Playwright auth regression |

## PR #515 disposition

PR #515 (`codex/implement-owner-first-self-host-auth-features-dyda8j`) has **exactly one commit** (`e0288f2`) on top of PR #514's head, and `git diff --stat` between the two branch heads produced **no output** — the trees are identical. PR #515 is a pure duplicate. No content from PR #515 was cherry-picked; everything it contained is already included via the three PR #514 commits above.

## Key changes included

- **Store auth**: `src/pages/Store.tsx` uses `useAuth().session.access_token` only. The hardcoded localStorage key and `eyMock` fallback are removed.
- **Owner go-live**: `handleGoLive` sends `activeGameId: null` for broadcast-only mode; per-game cache is only busted when the previous/current config is game-bound.
- **Owner/super_admin fast-path**: `handleStreamSessionHeartbeat` returns a synthetic session acknowledgement for super_admins without creating `stream_access_sessions` DB rows. No game-bound PPV/session gate is crossed.
- **NULL heartbeat fix**: `batch_heartbeat_upsert` uses `IS NOT DISTINCT FROM` for `game_id` comparisons so broadcast (NULL `game_id`) heartbeats match correctly.
- **NULL idempotency**: `UNIQUE NULLS NOT DISTINCT (user_id, game_id, idempotency_key)` replaces the old `UNIQUE` constraint so broadcast sessions are properly deduplicated.
- **Realtime bootstrap**: `sbbl-hq-selfhost/sbbl-hq-selfhost/volumes/db/realtime.sql` idempotently creates `_realtime` and `realtime` schemas; `docker-compose.yml` runs a one-shot `realtime-bootstrap` service before Realtime starts.
- **Store Playwright auth regression**: `e2e/store.spec.ts` now seeds a Supabase-compatible AuthContext session, mocks `/auth/v1/user` + PostgREST profile/role reads, and asserts `/api/store/quote` receives the AuthContext bearer token.
- **PWA dev service worker opt-in**: `vite.config.ts` makes service-worker generation opt-in to suppress the missing `dev-dist` Workbox warning.
- **SplashScreen React warning fix**: `loading="eager"` replaces the invalid `fetchPriority` prop.
- **/scores chaos-battery fix**: `e2e/build-chaos-battery.spec.ts` now wraps each route verification in `visitAndVerify` which: (a) asserts the URL settled on the expected path, (b) waits for `networkidle`, and (c) on failure attaches URL, headings, body text, and a full-page screenshot via `attachRouteDiagnostics`. The `Scores` heading assertion is unchanged.

## Explicit owner fast-path statement

`super_admin was not routed through game-bound PPV/session gates.`

Regression coverage confirms:

- `/api/broadcast/session` is used for owner playback (`game.id === 'broadcast'` routes there, not through `/api/streams/broadcast/*`).
- Super admin broadcast sessions do not create `stream_access_sessions` rows (synthetic heartbeat only).
- Super admin heartbeat accepts synthetic session IDs without a DB row.
- A second super admin broadcast session does not displace the first.

## Validation — npm ci

- Result: passed (1168 packages installed, 10 audit warnings — pre-existing).

## Validation — npm run typecheck

- Result: passed (`tsc --noEmit` exit code 0).

## Validation — npm run lint

- Result: see CI.

## Validation — targeted Vitest

Command run on this branch:

```bash
npx vitest run \
  src/test/broadcast-access-e2e.test.ts \
  src/test/paywall-rbac-audit.test.ts \
  src/test/login-page.test.tsx \
  src/test/login-google-capability.test.tsx \
  src/test/supabase-client-pkce.test.ts \
  src/test/worker-auth.test.ts \
  src/test/ingest-auth-regression.test.ts \
  src/test/ingest-storage-regression.test.ts \
  src/test/store-auth-token.test.tsx \
  --reporter=dot --max-workers=1
```

- Result: see CI. (Prior CodeX run on the same code: 9 files, 98 tests passed.)

## Validation — Store Playwright

```bash
npx playwright test e2e/store.spec.ts --project=chromium
```

- Result: see CI. (Prior CodeX run: 2 tests passed including `custom quote request submits idempotently`.)

## Validation — chaos battery

```bash
npx playwright test e2e/build-chaos-battery.spec.ts --project=chromium --trace on
```

- Result: see CI. The `/scores` route check now attaches diagnostics on failure so the next failure is traceable.

## Validation — self-host owner Playwright

```bash
npm run test:selfhost:owner
```

- Result: **skipped** — env vars `SELFHOST_SUPABASE_URL`, `SELFHOST_SUPABASE_ANON_KEY`, `SELFHOST_SUPABASE_SERVICE_ROLE_KEY`, `SELFHOST_OWNER_EMAIL`, `SELFHOST_OWNER_PASSWORD` were not present in this container. The spec is ready to run against a configured self-host stack.
- These tests are **not** presented as runtime proof of the live flow. They are a scaffold for operator validation.
