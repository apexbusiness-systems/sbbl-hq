# Protocol: Stats Tier Gating

**Status**: MANDATORY — enforced by worker handlers + vitest.
**Owner**: Data Pipeline (SBBL-HQ).
**Last updated**: 2026-04-16.

## TL;DR

> Stats and Leaderboards expose **two tiers** of data. The full stat line
> (pts, reb, ast, stl, blk, fls, min) is gated to paying players, coaches,
> and administrators. Everyone else sees a minimal stat line (pts, reb,
> ast) or, in the case of Leaderboards, no data at all (403 forbidden).

## Access matrix

| Role / state                                       | `/api/stats`       | `/api/leaderboards` |
|----------------------------------------------------|--------------------|---------------------|
| `super_admin`                                      | 200 · tier=`full`    | 200 · tier=`full`     |
| `league_admin`                                     | 200 · tier=`full`    | 200 · tier=`full`     |
| `coach`                                            | 200 · tier=`full`    | 200 · tier=`full`     |
| `team_manager`                                     | 200 · tier=`full`    | 200 · tier=`full`     |
| `player` with active subscription                  | 200 · tier=`full`    | 200 · tier=`full`     |
| `player` with expired/null subscription            | 200 · tier=`minimal` | **403 forbidden**   |
| `paid_fan`                                         | 200 · tier=`minimal` | **403 forbidden**   |
| `fan`                                              | 200 · tier=`minimal` | **403 forbidden**   |
| anonymous (no `x-sbbl-user-id-verified` header)    | 200 · tier=`minimal` | **403 forbidden**   |

The matrix is produced by `computeStatAccessTier(ctx)` in
`src/worker/index.ts`. `handleStats` always returns a successful response
and strips gated fields via `applyStatTier(row, tier)`. `handleLeaderboards`
rejects anything other than `tier === 'full'` with a 403 response body of
`{ ok: false, error: 'forbidden' }`.

## Wire format

Both endpoints return:

```json
{ "ok": true, "userId": "<uuid|null>", "tier": "full|minimal", "data": [ ... ] }
```

`data` is a flat array of `PlayerProfile` rows. When `tier === 'minimal'`,
each row's `stats` object has exactly `{ pts, reb, ast }` — the other four
fields are **omitted** (not zeroed) so server-side gating is auditable.

Frontend callers (`src/pages/Stats.tsx`, `src/pages/Leaderboards.tsx`)
read the `tier` field and render the appropriate stat columns. Stats.tsx
uses `FULL_STAT_KEYS` vs `MINIMAL_STAT_KEYS`; Leaderboards.tsx renders a
sign-in / upgrade gate on 401 or 403.

## Why

Previous to 2026-04-16, `/api/stats` and `/api/leaderboards` both
required auth and returned the same wrapped RPC payload to every
privileged caller. Public pages called them anonymously, got 401, and
silently fell back to hard-coded mock data. Fixing that exposed a
product question: who should actually be able to see the full stat line?

Leaderboards were always intended to be a premium benefit (registered
paid players, coaches, admins). The stat line is likewise tiered: fans
and anonymous viewers get enough to understand the league (points,
rebounds, assists) without the competitive intelligence (steals, blocks,
fouls, minutes) that drives roster decisions.

Centralising the tier computation in one function keeps policy changes
one-line edits. Adding a new privileged role is `FULL_STAT_ROLES.add(...)`.
Introducing a third tier is one new branch in `computeStatAccessTier`
plus one new case in `applyStatTier`.

## Tests

- `src/test/stats-tier-gating.test.ts` — end-to-end behavioural tests for
  every cell of the matrix.
- `src/test/public-data-pipeline.test.ts` — structural contract tests
  (handler bodies, route registration, frontend wiring).
- `src/test/worker-hardening-regression.test.ts` — cache-header regression
  guards for the stats endpoints.

Run them with `npx vitest run`. CI (`.github/workflows/ci.yml`) blocks
merges on failure.

## Updating the policy

1. Edit `FULL_STAT_ROLES` or the subscription-check branch in
   `computeStatAccessTier`.
2. If adding a new tier, extend the `StatAccessTier` union and update
   `applyStatTier` to strip additional fields. Update the PlayerProfile
   / StatLine types in `src/types/index.ts` to mark the new fields
   optional.
3. Update the frontend: `Stats.tsx` stat-key arrays, `Leaderboards.tsx`
   gate logic.
4. Update the matrix in this doc and `src/test/stats-tier-gating.test.ts`.
5. Run `npx vitest run` — all matrix tests must pass.

## Database support

The RPCs live in Supabase:

- `public.get_stats_dashboard(p_filters jsonb)` — returns aggregated
  per-player stats. Honors `p_filters->>'league'` (League code — SBBL /
  WBL / TGIFBL) since migration `20260416230000_stats_dashboard_league_filter`.
- `public.get_leaderboards(p_filters jsonb)` — historical RPC, not used
  by `/api/leaderboards` any more (it only returns pts/reb/ast; we use
  `get_stats_dashboard` so STL/BLK/FLS/MIN tabs work).

Data source: `public.player_game_stats` (one row per player per game).
Backfill lineage for historical POTG posters:

- `20260415143000_backfill_tgif_potg_tabulation.sql`
- `20260415153000_fix_tgif_potg_backfill_vs_split.sql`
- `20260415160000_backfill_tgif_potg_unmatched_players.sql`
- `20260416220000_backfill_stats_from_media_publications.sql`
  (covers publications that bypassed the import_jobs pipeline).

To retabulate a POTG publication, flip its
`render_payload->>'stats_backfilled'` to `false` and re-run the media
backfill migration (it's idempotent).
