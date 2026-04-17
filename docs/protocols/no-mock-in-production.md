# Protocol: No Mock Data in Production Pages

**Status**: MANDATORY — enforced by ESLint + vitest + CI.
**Owner**: Data Pipeline (SBBL-HQ).
**Last updated**: 2026-04-17.

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
  queryFn: () => apiFetch<{ ok: boolean; data: PlayerProfile[] }>('/api/public/stats'),
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

| Surface       | Endpoint                     | Shape                             | Source table/RPC             |
| ------------- | ---------------------------- | --------------------------------- | ---------------------------- |
| Stats         | `GET /api/public/stats`        | `{ ok, data: PlayerProfile[] }`   | RPC `get_stats_dashboard`    |
| Leaderboards  | `GET /api/public/leaderboards` | `{ ok, data: PlayerProfile[] }`   | RPC `get_stats_dashboard`†   |
| Scores        | `GET /api/scores`              | `{ ok, games: ScoreEntry[] }`     | `games` + joins              |
| Schedules     | `GET /api/public/schedule`     | `{ ok, data: Slot[] }`            | `schedule_slots`             |
| POTG          | `GET /api/public/potg`         | `{ ok, data: Publication[] }`     | `media_publications`         |
| Home snapshot | `GET /api/public/home`         | `{ ok, teams, liveGames, … }`     | multiple tables              |
| Teams         | `GET /api/teams`               | `{ ok, teams: TeamCard[] }`       | `teams` + `mvw_standings`    |
| Products      | `GET /api/public/products`     | `{ ok, data: Product[] }`         | `store_products`             |
| Overlay       | `GET /api/public/overlay/:gameId` | `{ ok, game, overlay, sponsor }` | `overlay_game_state` + joins |
| Polls         | `GET /api/public/engagement/polls` | `{ ok, data: Poll[] }`         | `engagement_polls`           |
| Fan leaderboard | `GET /api/public/engagement/leaderboard` | `{ ok, data: Row[] }`     | RPC `get_gamification_leaderboard` |
| Sponsors      | `GET /api/public/sponsors`     | `{ ok, data: Sponsor[] }`         | `sponsor_slots`              |
| AI digest     | `GET /api/public/digest`       | `{ ok, digest: Digest }`          | `ai_weekly_digest`           |

† Leaderboards uses the dashboard RPC because it returns the full stat
line per player; `get_leaderboards` only returns pts/reb/ast and would
break STL/BLK/FLS/MIN tabs.

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
  because `/api/stats` and `/api/leaderboards` require auth but the
  public pages called them anonymously. Worker gained
  `/api/public/stats` + `/api/public/leaderboards`; all mock fallbacks
  purged; ESLint + vitest guardrails installed (this doc).
