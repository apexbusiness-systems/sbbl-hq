<!-- Version: v1.2.1 | Date: 2026-04-07 | Status: Current -->
# Stats Pipeline

**Version:** v1.2.1
**Last Updated:** 2026-04-07

## Submission Workflow

1. **`create_game_stat_sheet`** â€” seeds draft context from game/rosters.
2. **`save_stat_draft`** â€” supports repeat autosave with idempotency keys.
3. **`finalize_game_stats`** â€” locks stat submission, records audit event, triggers standings refresh.
4. **`recompute_leaderboards`** â€” snapshots ranked outputs by league/season.

Required stat metrics: **PTS, REB, AST, STL, BLK, FLS, MIN**.

## Standings Materialized View

`mvw_standings` (20260404230000) pre-aggregates W/L/pts per `(league_id, season_id, team_id)`:

- **Trigger:** `trg_games_refresh_standings` fires `AFTER INSERT OR UPDATE OF status` on `games` â€” refreshes `CONCURRENTLY` when status transitions to `final`.
- **Unique index:** `(league_id, season_id, team_id)` required for concurrent refresh.
- **Columns:** `league_id`, `season_id`, `team_id`, `team_name`, `games_played`, `wins`, `losses`, `pts_for`, `pts_against`, `win_pct`, `refreshed_at`.

## Frontend Rendering

- **Stats page** (`src/pages/Stats.tsx`) and **Leaderboards page** (`src/pages/Leaderboards.tsx`) use **react-window v2** for virtualized list rendering when player count exceeds 50 rows.
- Row components are plain functions (not memo-wrapped) â€” react-window handles internal memoization.
- Memoized filter/sort state prevents unnecessary re-renders.

## Performance Indexes

Keyset pagination support (20260404220000):
- `games(created_at DESC)` â€” cursor for `/api/scores`
- `games(status, created_at DESC)` â€” filter push-down
- `import_jobs(created_at DESC)` â€” ops history cursor

Stats query indexes (20260404100000):
- `player_game_stats(game_id)` â€” per-game lookups
- `player_game_stats(player_id, pts DESC)` â€” leaderboard sorting


## Validation Reference (2026-04-07)

- Parser validation evidence: `docs/quality/evidence/parsers_2026-04-07.log`
- Scores endpoint validation evidence: `docs/quality/evidence/ingress_render_worker_2026-04-07.log`
- Full route wiring evidence: `docs/quality/evidence/all_worker_routes_2026-04-07.log`
- QA Matrix (signed): `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`
