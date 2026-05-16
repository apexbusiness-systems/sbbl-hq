# Owner Live + Self-Host Auth Evidence

## Commit SHA

- Commit SHA: `210cd1afb20076ed32d6dac75a1db66ca7a54e2e`

## Commands Run + Outputs

### `npm ci`

- Result: passed.
- Output summary: installed 1168 packages; audited 1169 packages.
- Warnings: current Node `v20.20.2` does not satisfy some package engine hints requiring Node `>=22.0.0`; npm reported 10 audit findings.

### `npm run typecheck`

- Result: passed.
- Output summary: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json` completed with exit code 0.

### Targeted Vitest validation

Command:

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
  --reporter=dot --max-workers=1
```

- Result: passed.
- Output summary: 8 test files passed; 96 tests passed.
- Warnings: React Router future-flag warnings in login tests only.

### Store auth regression

Command:

```bash
npx vitest run src/test/store-auth-token.test.tsx --reporter=dot --max-workers=1
```

- Result: passed.
- Output summary: 1 test file passed; 2 tests passed.
- Warning: React `act(...)` warning from async dialog state cleanup; assertions passed and no mocked/localStorage auth token was used.

### Broadcast ingest/go-live regression spot check

Command:

```bash
npx vitest run src/test/broadcast-ingest-pipeline.test.ts src/test/broadcast-access-e2e.test.ts src/test/store-auth-token.test.tsx --reporter=dot --max-workers=1
```

- Result: passed.
- Output summary: 3 test files passed; 48 tests passed.

### Docker validation

Command:

```bash
docker compose config
```

- Result: warning / skipped.
- Output: `docker not available`.

### Self-host owner Playwright validation

Commands:

```bash
npx playwright install chromium
npx playwright install-deps chromium
npm run test:selfhost:owner
```

- Result: passed as skipped in this local container.
- Output summary: 2 Playwright tests skipped because required self-host Supabase env vars were not present.
- The test file is ready to run against a real self-host stack with `SELFHOST_SUPABASE_URL`, `SELFHOST_SUPABASE_ANON_KEY`, `SELFHOST_SUPABASE_SERVICE_ROLE_KEY`, `SELFHOST_OWNER_EMAIL`, and `SELFHOST_OWNER_PASSWORD`.

## Auth Screenshots

The targeted self-host Playwright test attaches the following screenshots when run against a configured self-host environment:

- `signup`
- `signin`
- `session`
- `signout`

Local run status: skipped because self-host Supabase env vars were unavailable in this container.

## Owner Go-Live Screenshot with `activeGameId: null`

The owner self-host Playwright test attaches `owner-go-live-activeGameId-null` containing the `/ops/streams/go-live` response for:

```json
{
  "isLive": true,
  "collectionId": "https://cdn.example/live.m3u8",
  "title": "Owner Broadcast",
  "activeGameId": null
}
```

Local run status: skipped because self-host Supabase env vars were unavailable in this container.

## Playback URL / Session Response Proof

The owner self-host Playwright test posts to `/api/broadcast/session` and attaches `broadcast-session-response` with the playback URL and synthetic/owner session payload.

Local run status: skipped because self-host Supabase env vars were unavailable in this container.

## Ingest DB Proof

The owner self-host Playwright test attaches `ingest-db-proof`, containing selected rows from:

- `ingest_jobs`
- `media_publications`
- `audit_logs`

Local run status: skipped because self-host Supabase env vars were unavailable in this container.

## Explicit Owner Fast-Path Statement

`super_admin was not routed through game-bound PPV/session gates`.

Regression coverage confirms:

- `/api/broadcast/session` is used for owner playback.
- Super admin broadcast sessions do not create `stream_access_sessions` rows.
- Super admin heartbeat accepts synthetic session IDs without a DB row.
- A second super admin broadcast session does not displace the first.

## Follow-up: Realtime Schema Bootstrap Fix

- Commit SHA: `cdd6613c2177c8c2766ed3d6809ca3434a6feaf4`
- Diagnosis: self-host Realtime v2.76.5 logs reported `MigrationsFailedToRun` with Postgres error `schema "realtime" does not exist` during tenant migration startup.
- Fix summary: `volumes/db/realtime.sql` now idempotently creates both `_realtime` and `realtime`; `docker-compose.yml` now runs a one-shot `realtime-bootstrap` service before Realtime so existing persisted Docker volumes are repaired before Realtime migrations run.

### Follow-up commands

```bash
npm run typecheck
```

- Result: passed.
- Output summary: TypeScript app and node configs completed with exit code 0.

```bash
docker compose -f sbbl-hq-selfhost/sbbl-hq-selfhost/docker-compose.yml config
```

- Result: warning / not runnable in this container.
- Output: `/bin/bash: line 1: docker: command not found`.

```bash
npx playwright install chromium
npx playwright install-deps chromium
npm run test:selfhost:owner
```

- Result: passed as skipped in this container.
- Output summary: Playwright Chromium and OS dependencies installed; `npm run test:selfhost:owner` executed and reported 2 skipped tests because required self-host Supabase env vars were not present in this container.
