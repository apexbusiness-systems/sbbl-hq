# Claude / Agent Operating Guide â SBBL-HQ

Welcome. This document is the **single source of truth** for agents
working in this repo. Read it in full before your first edit.

## ð¨ HARD RULES â Do not break these

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

- **ESLint** `no-restricted-imports` (see `eslint.config.js`) â lint runs
  with `--max-warnings 0` in CI.
- **vitest** guard test (`src/test/no-mock-in-production.test.ts`).
- **CI** (`.github/workflows/ci.yml`) â both gates block merge.

If you see a test failure pointing at those files, **do not disable the
test**. Fix the import.

If you need league identity metadata (codes, names, colors, logos), use
`LEAGUE_REGISTRY` from `src/lib/leagues.ts`. It is the canonical source.

### 2. No `|| mockX` / `?? mockX` fallbacks

Do not write:

```ts
// â BANNED â silently hides pipeline outages.
const players = apiData && apiData.length > 0 ? apiData : mockPlayers;
const potg = apiPotg ?? playersOfTheGame;
```

Do write:

```ts
// â CORRECT â empty state is visible.
const players = Array.isArray(apiData) ? apiData : [];
```

Render an explicit empty-state UI when the array is empty. Never
substitute fixtures.

### 3. Public pages â public endpoints

If a page is anonymous-accessible (Stats, Leaderboards, Scores,
Schedules, Home, AppHome, Store, Teams), it must call a public worker
endpoint (`/api/public/*` or `/api/teams` / `/api/scores`). Endpoints
under `/api/stats`, `/api/leaderboards`, `/api/auth/*` etc. require auth
(`requireAuth(req)` in the worker) and **will 401 for anonymous users**,
silently killing the data flow.

Before wiring a page to a new endpoint, grep the worker for
`requireAuth(req)` in the handler. If present and the page is public,
use or add a `/api/public/*` variant instead.

### 4. Stream Independence Contract â streams are not games

**NEVER** couple `streams`, `stream_assignments`, or
`stream_entitlements` to a NOT-NULL `game_id`. Streams are first-class
addressable media resources; a game MAY have zero, one, or many streams
via `stream_assignments`. Entitlements gate `stream_id`; `game_id` is a
nullable legacy column retained for backward compatibility only.

Forbidden patterns (CI will block):

```sql
-- â BANNED â cements the coupling we removed.
ALTER TABLE streams ADD COLUMN game_id uuid NOT NULL;
ALTER TABLE stream_entitlements ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE stream_assignments ALTER COLUMN game_id SET NOT NULL;
```

```ts
// â BANNED â reading games.stream_url from worker/frontend paths.
const url = game.stream_url;
```

Do instead:

```ts
// â CORRECT â resolve via stream_assignments / streams.
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

- **CI AST gate** (`.github/workflows/stream-contract-gate.yml`) â pglast
  parser scans migration diffs for forbidden `NOT NULL` on `game_id`.
- **Armageddon test battery** (`src/test/armageddon-stream-invariants.test.ts`).
- **Vitest stage tests** (`src/test/stream-independence-stage*.test.ts`).
- **Sentry alert** on `stream.access.v2` error rate > 0.1%.

### 5. Live Player Invariants — do not regress v1.4.0

The live-stream player (`src/components/LiveStreamPlayer.tsx`) is the
**single most regression-prone surface in the app**. v1.4.0 hardened it
after a five-incident cascade. The invariants below MUST hold:

#### 5.1 — Layout: never combine `absolute` with `relative` on the player wrapper

The Gate-2 wrapper must be:

```tsx
// CORRECT
<div className="absolute inset-0 flex flex-col z-0">
```

```tsx
// BANNED — Tailwind emits position:relative last; the wrapper drops
// out of its absolute-positioned ancestor, the iframe collapses to
// min-height, and the controls bar floats mid-canvas above empty space.
<div className="absolute inset-0 flex flex-col relative z-0">
```

`z-0` alone gives an absolute element its own stacking context.

#### 5.2 — Timers: every `setTimeout` / `setInterval` must be cleared on unmount

Both the **6-hour session-cap timer** and the **3-second auto-retry timer**
previously leaked closures for up to six hours after navigation. Every
new timer in the player MUST:

1. Capture the handle in a ref (component-scope) or local var (effect-scope).
2. Clear it in the effect cleanup (`return () => { ... }`).
3. Clear it before scheduling a replacement (no overlapping timers).

Pattern reference: `hardCapTimerId` and `autoRetryTimerRef` in `LiveStreamPlayer.tsx`.

#### 5.3 — Unembeddable URLs must bail before ReactPlayer mounts

Provider types that cannot play under our locked-down CSP MUST short-circuit
in `StreamPlayer` with an advisory panel, mirroring the existing RTMP branch:

| Type | Why blocked |
|---|---|
| `rtmp` | Browsers cannot decode RTMP. |
| `facebook` | `connect.facebook.net/sdk.js` is intentionally not in our `script-src` (killed in `89d9696` to stop the CacheFirst storm). |
| `kick`, `instagram`, `x-spaces` | No public embed surface compatible with our CSP. |

Forbidden:

```ts
// BANNED — lets ReactPlayer mount, FB SDK trips CSP, FilePlayer
// fall-through reports "no supported sources" with no admin hint.
<ReactPlayer url={facebookUrl} />
```

Required:

```ts
// CORRECT — advisory before mount, ReactPlayer never sees the URL.
if (isFacebook) return <FacebookAdvisoryPanel />;
```

#### 5.4 — `react-player` must be lazy-loaded

```ts
// CORRECT — each provider is a separate dynamic chunk; FB code
// never executes unless an FB URL is rendered (it isn't, per 5.3).
import ReactPlayer from 'react-player/lazy';
```

The bare `react-player` import is **lint-blocked** by
`no-restricted-imports` in `eslint.config.js`. Do not bypass.

### Enforcement (all run in CI on every PR)

- **Source-level regression tests**:
  `src/test/live-stream-player-regressions.test.ts` (11 assertions,
  one per invariant above; mutation-tested).
- **Pipeline simulation**: `npm run simulate:broadcast` walks 19
  representative URLs through the full ingest pipeline. Add a scenario
  to `scripts/simulate-broadcast.ts` whenever you add a new provider
  type or a new branch in `StreamPlayer`.
- **ESLint** (`no-restricted-imports`): blocks bare `react-player`.
- **Vitest**: `src/test/live-page-*.test.tsx` covers each access-gate path.

If a regression test fails on your branch, **read the failing assertion**.
Each one maps to a real production incident from v1.3.x. Disabling the
test is never the right answer.

## Architecture at a glance

```
React (src/)
  âââ src/pages/**             â page-level components; fetch via react-query
  âââ src/components/**        â shared UI; never fetch directly
  âââ src/lib/api/**           â thin API client wrappers
  âââ src/lib/leagues.ts       â LEAGUE_REGISTRY (canonical branding)

Cloudflare Worker (src/worker/index.ts, src/worker/routes/*)
  âââ requireAuth(req)          â throws on missing x-sbbl-user-id-verified
  âââ admin = getAdminClient()  â Supabase service-role
  âââ route table at bottom     â append new routes here

Supabase
  âââ tables                    â players, teams, games, leagues, seasons,
  â                               player_game_stats, store_products,
  â                               media_publications, â¦
  âââ RPCs                      â get_stats_dashboard, get_leaderboards,
  â                               mark_order_paid, finalize_game_stats, â¦
  âââ migrations                â supabase/migrations/*.sql (date-prefixed)
```

Data flow for any page:

1. Page calls `useQuery(apiFetch('/api/public/X'))`.
2. Worker handler runs Supabase query (service role â RLS-free).
3. Handler returns `{ ok, data }` with edge cache headers.
4. Page renders the array. Empty = visible empty state.

## Skills & Commands

This project includes 7 APEX skills and 1 project context profile in
`.claude/skills/`. Each skill has YAML frontmatter with `name`,
`description`, and `triggers` for auto-discovery. See
[`.claude/README.md`](.claude/README.md) for the full skill map.

**Available slash commands:**
- `/project:apex-power` — Activate APEX-POWER-20X execution protocol
- `/project:debug` — Activate 8-phase debug protocol
- `/project:qa-gate` — Run zero-trust QA verification matrix

**Skill hierarchy:**
```
apex-power (meta-skill) → omnidev-v2 | apex-master-debug | apex-frontend
                        → apex-omnitest | apex-memory | apex-qa
sbbl-agent (project context) → domain awareness for all skills
```

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
   an existing one â they are immutable once merged).
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

- **2026-04-16** â Live data regression. Store/Leaderboards/Scores/
  Stats/Live silently showed mock data because
  `/api/stats` + `/api/leaderboards` required auth but the public pages
  called them anonymously, and every page had a `|| mockX` fallback.
  Fix: made `/api/stats` tier-aware (anonymous callers get limited data,
  no 401); added explicit login-gate UI in Leaderboards for unauthenticated
  visitors; purged all mock fallbacks from production pages; installed ESLint
  + vitest guardrails (this guide). See
  [`docs/protocols/no-mock-in-production.md`](docs/protocols/no-mock-in-production.md)
  for details.
