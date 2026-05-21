# Protocol: No Mock Data in Production Pages

**Status**: MANDATORY — enforced by ESLint + vitest + CI.
**Owner**: Data Pipeline (SBBL-HQ).
**Last updated**: 2026-05-21.

## TL;DR

> **Production UI code must never import from `src/data/mock.ts`,
> `src/data/schedules.ts`, or `src/data/teams.ts`.** Those files exist
> only for tests and Storybook. Use the `/api/public/*` worker endpoints.

The rule is enforced by:

1. **ESLint** — `eslint.config.js` has a `no-restricted-imports` rule that
   blocks these paths from `src/pages/**`, `src/components/**`,
   `src/hooks/**`, `src/contexts/**`, `src/worker/**`, and `src/lib/**`
   (tests are exempt). Lint runs with `--max-warnings 0` in CI.
2. **Vitest** — `src/test/no-mock-in-production.test.ts` walks the source
   tree and asserts no production file imports fixtures. It also flags
   inline redeclarations of known fixture identifiers
   (`playersOfTheGame`, `SCHEDULE_DATA`, `STATIC_TEAMS`).
3. **CI** — `.github/workflows/ci.yml` runs both on every push/PR.

Both layers must stay green. If either fails, the merge is blocked.

## Why this rule exists

Between Apr 14 and Apr 16, 2026, multiple production surfaces silently
regressed to mock data. Users viewing Stats, Leaderboards, Scores, Store,
Home, AppHome, and Profiles saw **fake players, fake scores, and fake
products** because the pages were wired with conditional fallbacks:

```ts
// ❌ ANTI-PATTERN — do not do this.
const players = apiData && apiData.length > 0 ? apiData : mockPlayers;
```

When the worker returned empty, errored, or (as in this incident) hit an
auth-gated endpoint anonymously and got a 401, the UI silently switched
to hard-coded mock data. The cause of the regression was invisible from
the outside — the UI looked "fine" but was lying.

This has happened repeatedly. The only durable fix is to make the
fixtures structurally unreachable from production code paths.

## The correct pattern

Always render from the API response. Render an explicit empty state when
the response is empty or errored. Never silently substitute fixtures.

```ts
// ✅ CORRECT — read from the live API; empty state on no data.
const statsQuery = useQuery({
  queryKey: ['public-stats', leagueFilter],
  queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/stats'),
});

const players = useMemo<PlayerProfile[]>(() => {
  const apiData = statsQuery.data?.data;
  return Array.isArray(apiData) ? apiData : [];
}, [statsQuery.data]);

// Render a visible empty state when players.length === 0 — never a fixture.
```

## Canonical public endpoints

Anonymous-accessible endpoints that back the public pages. Each returns
`{ ok: boolean, data: <array> }` or the documented shape. The response
is cached at the edge.

| Surface       | Endpoint                     | Shape                             | Auth                         | Source table/RPC             |
| ------------- | ---------------------------- | --------------------------------- | ---------------------------- | ---------------------------- |
| Stats         | `GET /api/stats`               | `{ ok, tier, data: PlayerProfile[] }` | Optional — tier-aware   | RPC `get_stats_dashboard`    |
| Leaderboards  | `GET /api/leaderboards`        | `{ ok, data: PlayerProfile[] }`   | Required — full tier only†   | RPC `get_stats_dashboard`    |
| Scores        | `GET /api/scores`              | `{ ok, games: ScoreEntry[] }`     | None                         | `games` + joins              |
| Schedules     | `GET /api/public/schedule`     | `{ ok, data: Slot[] }`            | None                         | `schedule_slots`             |
| POTG          | `GET /api/public/potg`         | `{ ok, data: Publication[] }`     | None                         | `media_publications`         |
| Home snapshot | `GET /api/public/home`         | `{ ok, teams, liveGames, … }`     | None                         | multiple tables              |
| Teams         | `GET /api/teams`               | `{ ok, teams: TeamCard[] }`       | None                         | `teams` + `mvw_standings`    |
| Products      | `GET /api/public/products`     | `{ ok, data: Product[] }`         | None                         | `store_products`             |
| OmniBridge inbound | `POST /webhooks/omnihub`  | `{ ok, status, command_id }`      | HMAC-SHA256 (no mock)        | `api_idempotency_keys` + `log_admin_action` RPC |
| OmniPort command   | `POST /api/omniport/command` | `{ ok, result }`               | Operator JWT only (no mock)  | Worker-only, no DB write     |

† `/api/stats` is tier-aware: anonymous callers receive a limited stat line
(pts/reb/ast only). Authenticated paid players/coaches/admins get the full
line. The endpoint returns `Cache-Control: public` for anonymous requests
and `private, no-store` for authenticated ones.

† `/api/leaderboards` requires full-tier access (paid player, coach, team
manager, league_admin, super_admin). Anonymous and basic-fan callers receive
a 403; the Leaderboards page shows a login gate in response.

## Reference data (always allowed)

These files are **not** fixtures and are safe to import from anywhere:

- `src/lib/leagues.ts` → `LEAGUE_REGISTRY`, `getLeagueConfig`,
  `leagueCodeFromId`, `getLeagueSeasonLabel` — canonical league branding.
- `src/types/index.ts` → shared TS types.

If you need a constant like a league name or code, use `LEAGUE_REGISTRY`.
Never hard-code league metadata in a page.

## How to update this rule

If a new fixture file is added (e.g. `src/data/foo.ts`) and must be
kept out of production code, update:

1. `eslint.config.js` → `DATA_FIXTURE_PATTERNS` — add the new path.
2. `src/test/no-mock-in-production.test.ts` → `FORBIDDEN_IMPORT_RE` and
   (if the file exports named constants that could be inlined)
   `FIXTURE_IDENTS`.
3. This document → the "canonical public endpoints" table, if it maps to
   a new worker route.

## Incident history

- **2026-04-16** — Store/Leaderboards/Scores/Stats/Live showed mock data
  because every page had a `|| mockX` fallback that silently activated
  when the API returned an error or empty result. Fix: purged all mock
  fallbacks from production pages; made `/api/stats` tier-aware so
  anonymous callers receive a limited (non-empty) stat line instead of
  a 401; added explicit login-gate UI in Leaderboards for unauthenticated
  visitors; installed ESLint + vitest guardrails (this doc).
