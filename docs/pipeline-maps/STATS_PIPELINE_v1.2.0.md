<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# Stats Pipeline

**Version:** v1.2.0
**Last Updated:** 2026-04-04

## Submission Workflow

1. **`create_game_stat_sheet`** — seeds draft context from game/rosters.
2. **`save_stat_draft`** — supports repeat autosave with idempotency keys.
3. **`finalize_game_stats`** — locks stat submission, records audit event, triggers standings refresh.
4. **`recompute_leaderboards`** — snapshots ranked outputs by league/season.

Required stat metrics: **PTS, REB, AST, STL, BLK, FLS, MIN**.

## Standings Materialized View

`mvw_standings` (20260404230000) pre-aggregates W/L/pts per `(league_id, season_id, team_id)`:

- **Trigger:** `trg_games_refresh_standings` fires `AFTER INSERT OR UPDATE OF status` on `games` — refreshes `CONCURRENTLY` when status transitions to `final`.
- **Unique index:** `(league_id, season_id, team_id)` required for concurrent refresh.
- **Columns:** `league_id`, `season_id`, `team_id`, `team_name`, `games_played`, `wins`, `losses`, `pts_for`, `pts_against`, `win_pct`, `refreshed_at`.

## Frontend Rendering

- **Stats page** (`src/pages/Stats.tsx`) and **Leaderboards page** (`src/pages/Leaderboards.tsx`) use **react-window v2** for virtualized list rendering when player count exceeds 50 rows.
- Row components are plain functions (not memo-wrapped) — react-window handles internal memoization.
- Memoized filter/sort state prevents unnecessary re-renders.

## Performance Indexes

Keyset pagination support (20260404220000):
- `games(created_at DESC)` — cursor for `/api/scores`
- `games(status, created_at DESC)` — filter push-down
- `import_jobs(created_at DESC)` — ops history cursor

Stats query indexes (20260404100000):
- `player_game_stats(game_id)` — per-game lookups
- `player_game_stats(player_id, pts DESC)` — leaderboard sorting
