# 2026-07-21 — League Resolution Audit (PR #571)

## Incident

Every league filter chip (WBL / SBBL / TGIF) on the ops media console
(`/ops` → Media) returned **500** from `GET /ops/list/media?leagueId=<slug>`.
"All Leagues" worked. Console showed repeated
`Failed to load resource: the server responded with a status of 500`.

## Root cause

`media_publications.league_id` is a uuid FK to `leagues.id`. The frontend
sends the app-level league slug from `LEAGUE_REGISTRY` (`wbl`, `sbbl`,
`tgifbl`), and `handleOpsListMediaPublications` passed it straight into
`.eq('league_id', slug)` → Postgres `22P02 invalid input syntax for type
uuid` → 500.

## Audit findings — 8 independent implementations of the same lookup

| # | Site | File | Pre-fix behavior on slug input |
|---|------|------|--------------------------------|
| 1 | `handleOpsListMediaPublications` | `src/worker/index.ts` | **500 crash** (the incident) |
| 2 | `fetchPublicMediaRows` (`/media`, `/media/posters`) | `src/worker/index.ts` | Latent same-shape crash |
| 3 | `handleOpsPatchMediaPublications` | `src/worker/index.ts` | Correct — point-fixed in PR #567 (proof the class recurs) |
| 4 | `handleTeamsList` (`GET /api/teams`) | `src/worker/index.ts` | Silent degradation: fetched all 200 teams, filtered in JS; standings filter silently skipped |
| 5 | POTG ingest validation | `src/worker/index.ts` | Own inline lookup (`potg_unknown_league`), no UUID pass-through |
| 6 | Ingest publish path | `src/worker/index.ts` | Silently nulled `league_id` on unknown code; DB errors swallowed |
| 7 | Game/event create | `src/worker/index.ts` | Silently nulled `league_id` on unknown code; DB errors swallowed |
| 8 | Weekly digest (facts, upsert, public — 3 spots) | `src/worker/routes/digest.ts` | Silently nulled `league_id`; DB errors swallowed |

## Fix

Single source of truth in `src/worker/shared.ts`:

- `resolveLeagueId(admin, raw)` — UUID pass-through, else case-insensitive
  `leagues.code` lookup, else `leagues.name` fallback (legacy `/api/teams`
  parity). `null` = unknown league. Throws on DB error instead of silently
  nulling.
- `resolveLeagueIdFilter(admin, raw)` — list/filter variant; `null` = no
  filter requested, `LEAGUE_NO_MATCH` sentinel = filter given but no such
  league → caller returns explicit zero rows.

All 8 sites migrated. `handleTeamsList` now filters DB-side (teams **and**
`mvw_standings`) by the resolved UUID.

## Live-data verification (2026-07-21)

`leagues` table (production Supabase): codes `WBL`, `SBBL`, `TGIFBL` — the
registry slugs `wbl` / `sbbl` / `tgifbl` match case-insensitively, so the
`ilike('code', slug)` lookup resolves all three real leagues.

## Enforcement

- `src/test/worker-league-filter-regression.test.ts` — 10 tests pinning
  slug→UUID resolution, UUID pass-through, name fallback, unknown-league →
  zero rows, and throw-on-DB-error semantics.
- `src/test/league-filter-guard.test.ts` — CI tripwire: fails if any worker
  file outside `shared.ts` contains `.ilike('code', …)`, or if `shared.ts`
  stops exporting the canonical helpers.
- CLAUDE.md rule **10** documents the forbidden/required patterns.

## Validation gates

`npm run typecheck` ✅ · `npm run lint` (zero-warning) ✅ ·
`npm test` (132 files / 1364 tests) ✅ · `npm run build` ✅
