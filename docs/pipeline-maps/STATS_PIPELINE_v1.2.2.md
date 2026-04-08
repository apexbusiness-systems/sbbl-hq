<!-- Version: v1.2.2 | Date: 2026-04-07 | Status: Current -->
# Stats Pipeline

**Version:** v1.2.2  
**Last Updated:** 2026-04-07  
**Supersedes:** v1.2.1

## Workflow

1. `create_game_stat_sheet` seeds draft context.
2. `save_stat_draft` performs idempotent draft saves.
3. `finalize_game_stats` locks stat sheet and triggers standings refresh.
4. `recompute_leaderboards` refreshes ranked outputs.

## Required Metrics

`PTS`, `REB`, `AST`, `STL`, `BLK`, `FLS`, `MIN`

## Ingress/Render Reliability Notes

- Stats ingress/render route wiring remains covered by worker route checklist tests.
- Environment-boundary hardening from this pass applies globally to all Worker routes.
- No direct schema or metric logic changes were introduced in this pass.

## Validation Reference (2026-04-07 Hardening Pass)

- `docs/quality/evidence/hardening_tests_2026-04-07.log`
- `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.2.0.md`
- Baseline endpoint inventory: `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`
