# Correction: League Slug→UUID Resolution Consolidated to a Single Source of Truth

- **Date:** 2026-07-21
- **Scope:** Project-wide (Cloudflare Worker, tests, CI guard, documentation)
- **Affected Pages:** `src/worker/shared.ts`, `src/worker/index.ts`, `src/worker/routes/digest.ts`, `src/test/worker-league-filter-regression.test.ts`, `src/test/league-filter-guard.test.ts`, `src/test/worker-teams-route.test.ts`, `CLAUDE.md`, `CHANGELOG.md`, `docs/CHANGELOG.md`, `docs/protocols/no-mock-in-production.md`, `docs/architecture/API_REFERENCE_v1.2.0.md`
- **Promotion Decision:** Core directive (CLAUDE.md rule 10) + CI-enforced guard test

## Original Assumptions vs. Corrected State

### 1. League identifiers could be filtered directly
- **Original Assumption:** A client-supplied `leagueId` query param or body field
  could be passed into `.eq('league_id', value)` — each handler independently
  decided how (or whether) to convert it.
- **Corrected State:** Frontends send `LEAGUE_REGISTRY` slugs (`wbl`, `sbbl`,
  `tgifbl`), but every `league_id` column is a uuid FK to `leagues.id`
  (live DB codes verified 2026-07-21: `WBL`, `SBBL`, `TGIFBL` — slugs match
  case-insensitively). A raw slug in a uuid filter throws Postgres `22P02` → 500,
  which is exactly what broke every league filter chip on `/ops/media`.

### 2. Point fixes stick
- **Original Assumption:** Fixing the lookup in one handler (PR #567 fixed
  `handleOpsPatchMediaPublications`) resolved the bug class.
- **Corrected State:** The audit found **8** independent hand-rolled copies of
  the same lookup, each drifted: `/ops/list/media` crashed (the incident);
  `GET /api/teams` silently degraded to fetch-all-then-JS-filter; POTG/ingest/
  game-create write paths silently nulled `league_id`; 3 digest lookups had
  their own copies. Point fixes to a duplicated pattern do not stick — the
  pattern must be consolidated and guarded.

## Resolution
- Single implementation in `src/worker/shared.ts`: `resolveLeagueId` (UUID
  pass-through → case-insensitive `code` lookup → `name` fallback; null on
  no match; throws on DB error) and `resolveLeagueIdFilter` (adds the
  `LEAGUE_NO_MATCH` sentinel: unknown league → explicit zero rows, never a
  dropped filter, never a crash).
- All 8 call sites migrated; `handleTeamsList` now filters DB-side (teams and
  `mvw_standings`) by the resolved UUID.
- CI guard `src/test/league-filter-guard.test.ts` fails the build if any worker
  file outside `shared.ts` hand-rolls `.ilike('code', …)` again.
- Regression suite `src/test/worker-league-filter-regression.test.ts` pins the
  incident semantics (10 tests).
- Verified: typecheck, ESLint (zero-warning), full vitest suite
  (132 files / 1364 tests), production build — all green.
