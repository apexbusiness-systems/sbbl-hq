# Claude / Agent Operating Guide — SBBL-HQ

Welcome. This document is the **single source of truth** for agents
working in this repo. Read it in full before your first edit.

## 🚨 HARD RULES — Do not break these

### 1. No mock data in production pages

**NEVER** import from `src/data/mock.ts`, `src/data/schedules.ts`, or
`src/data/teams.ts` anywhere under `src/pages/**`, `src/components/**`,
`src/hooks/**`, `src/contexts/**`, `src/worker/**`, or `src/lib/**`.

Those files are test fixtures. Importing them from production code has
repeatedly caused live-data outages to be invisible to users (the UI
silently renders fake players, scores, and products instead of failing).

**Use instead:** the `/api/public/*` worker endpoints. See
[`docs/protocols/no-mock-in-production.md`](docs/protocols/no-mock-in-production.md)
for the canonical endpoint table.

This rule is enforced by:

- **ESLint** `no-restricted-imports` (see `eslint.config.js`) — lint runs
  with `--max-warnings 0` in CI.
- **vitest** guard test (`src/test/no-mock-in-production.test.ts`).
- **CI** (`.github/workflows/ci.yml`) — both gates block merge.

If you see a test failure pointing at those files, **do not disable the
test**. Fix the import.

If you need league identity metadata (codes, names, colors, logos), use
`LEAGUE_REGISTRY` from `src/lib/leagues.ts`. It is the canonical source.

### 2. No `|| mockX` / `?? mockX` fallbacks

Do not write:

```ts
// ❌ BANNED — silently hides pipeline outages.
const players = apiData && apiData.length > 0 ? apiData : mockPlayers;
const potg = apiPotg ?? playersOfTheGame;
```

Do write:

```ts
// ✅ CORRECT — empty state is visible.
const players = Array.isArray(apiData) ? apiData : [];
```

Render an explicit empty-state UI when the array is empty. Never
substitute fixtures.

### 3. Public pages → public endpoints

If a page is anonymous-accessible (Stats, Leaderboards, Scores,
Schedules, Home, AppHome, Store, Teams), it must call a public worker
endpoint (`/api/public/*` or `/api/teams` / `/api/scores`). Endpoints
under `/api/stats`, `/api/leaderboards`, `/api/auth/*` etc. require auth
(`requireAuth(req)` in the worker) and **will 401 for anonymous users**,
silently killing the data flow.

Before wiring a page to a new endpoint, grep the worker for
`requireAuth(req)` in the handler. If present and the page is public,
use or add a `/api/public/*` variant instead.

### 4. Stream Independence Contract — streams are not games

**NEVER** couple `streams`, `stream_assignments`, or
`stream_entitlements` to a NOT-NULL `game_id`. Streams are first-class
addressable media resources; a game MAY have zero, one, or many streams
via `stream_assignments`. Entitlements gate `stream_id`; `game_id` is a
nullable legacy column retained for backward compatibility only.

Forbidden patterns (CI will block):

```sql
-- ❌ BANNED — cements the coupling we removed.
ALTER TABLE streams ADD COLUMN game_id uuid NOT NULL;
ALTER TABLE stream_entitlements ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE stream_assignments ALTER COLUMN game_id SET NOT NULL;
```

```ts
// ❌ BANNED — reading games.stream_url from worker/frontend paths.
const url = game.stream_url;
```

Do instead:

```ts
// ✅ CORRECT — resolve via stream_assignments / streams.
const { data } = await admin
  .from("stream_assignments")
  .select("streams(stream_url, source_platform)")
  .eq("game_id", gameId)
  .eq("is_active", true)
  .maybeSingle();
```

Before modifying any stream/ppv/entitlement code, **read**
[`docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md`](docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md).

This rule is enforced by:

- **CI AST gate** (`.github/workflows/stream-contract-gate.yml`) — pglast
  parser scans migration diffs for forbidden `NOT NULL` on `game_id`.
- **Armageddon test battery** (`src/test/armageddon-stream-invariants.test.ts`).
- **Vitest stage tests** (`src/test/stream-independence-stage*.test.ts`).
- **Sentry alert** on `stream.access.v2` error rate > 0.1%.

## Architecture at a glance

```
React (src/)
  ├── src/pages/**             ← page-level components; fetch via react-query
  ├── src/components/**        ← shared UI; never fetch directly
  ├── src/lib/api/**           ← thin API client wrappers
  └── src/lib/leagues.ts       ← LEAGUE_REGISTRY (canonical branding)

Cloudflare Worker (src/worker/index.ts, src/worker/routes/*)
  ├── requireAuth(req)          ← throws on missing x-sbbl-user-id-verified
  ├── admin = getAdminClient()  ← Supabase service-role
  └── route table at bottom     ← append new routes here

Supabase
  ├── tables                    ← players, teams, games, leagues, seasons,
  │                               player_game_stats, store_products,
  │                               media_publications, …
  ├── RPCs                      ← get_stats_dashboard, get_leaderboards,
  │                               mark_order_paid, finalize_game_stats, …
  └── migrations                ← supabase/migrations/*.sql (date-prefixed)
```

Data flow for any page:

1. Page calls `useQuery(apiFetch('/api/public/X'))`.
2. Worker handler runs Supabase query (service role — RLS-free).
3. Handler returns `{ ok, data }` with edge cache headers.
4. Page renders the array. Empty = visible empty state.

## Common tasks

### Add a new public data surface

1. **Worker**: add a handler in `src/worker/index.ts` (no `requireAuth`);
   register in the route table; set `Cache-Control` to
   `public, s-maxage=30, max-age=15` (or similar).
2. **API client**: add the wrapper in `src/lib/api/public.ts`.
3. **Page**: fetch via `useQuery`; no fallback; render empty state.
4. **Docs**: add the endpoint to
   `docs/protocols/no-mock-in-production.md`.

### Modify a Supabase RPC

1. Add a new dated migration under `supabase/migrations/` (NEVER edit
   an existing one — they are immutable once merged).
2. Update the worker handler if the response shape changes.
3. Update the frontend type and its consumers.

## Validation gates (all required green)

```
npm run typecheck   # strict TS across app + node configs
npm run lint        # ESLint with zero-warning policy
npm test            # vitest unit+integration suite
npm run build       # production build (vite)
```

CI runs all of these. Do not merge red.

## Incident history (relevant to this guide)

- **2026-04-16** — Live data regression. Store/Leaderboards/Scores/
  Stats/Live silently showed mock data because
  `/api/stats` + `/api/leaderboards` required auth but the public pages
  called them anonymously, and every page had a `|| mockX` fallback.
  Fix: added `/api/public/stats` + `/api/public/leaderboards`; purged
  all mock fallbacks from production pages; installed ESLint + vitest
  guardrails (this guide). See
  [`docs/protocols/no-mock-in-production.md`](docs/protocols/no-mock-in-production.md)
  for details.
