# Stats Pipeline

1. `create_game_stat_sheet` seeds draft context from game/rosters.
2. `save_stat_draft` supports repeat autosave with idempotency keys.
3. `finalize_game_stats` locks stat submission and records audit event.
4. `recompute_leaderboards` snapshots ranked outputs by league/season.

Required stat metrics: PTS, REB, AST, STL, BLK, FLS, MIN.
