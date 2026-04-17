<!-- Version: v1.2.0 | Date: 2026-04-17 | Status: Current -->
# CHANGELOG

All notable changes to SBBL HQ are documented in this file.
Versioning follows [semantic versioning](https://semver.org) with UTC date stamps.

---

## 2026-04-17 — v1.2.0 — Broadcast overlay, engagement, sponsors, AI digest, OBS control

Closes every gap called out in the investor-readiness research memo:

- **Scoreboard overlay** — new chromeless `/overlay/:gameId` route
  serves OBS as a 1920×1080 transparent browser source. Renders score,
  clock (ticks at 10 Hz between 1 s polls), period, fouls, timeouts,
  possession indicator, bonus flags, lower third, and sponsor bug.
- **Overlay control** — admin-only `/overlay-control/:gameId` console
  drives every scoreboard field: +1/+2/+3 scoring, -1 correction,
  start/stop/set clock, period advance, fouls, timeouts, possession,
  lower-third announce/hide, one-click reset, OBS command buttons.
- **Interactive engagement** — `/engage` page with three tabs: Polls &
  Trivia, Watch Parties, Leaderboard. Anonymous fans see results;
  signed-in fans cast votes (one per poll), earn gamification points
  when graded, and host/join watch parties via 6-char invite codes.
- **Sponsor overlay system** — `sponsor_slots` table + admin CRUD +
  public rotation (15 s deterministic slot) + impression/click
  tracking via `sponsor_impressions`.
- **AI weekly digest** — new `/digest` page backed by
  `ai_weekly_digest` cache keyed on `(league_id, week_start)`. Worker
  collects real facts from `games` + `player_game_stats`, calls Groq
  `llama-3.3-70b-versatile` when `GROQ_API_KEY` is set, falls back to
  a deterministic template otherwise. Per-league tabs (SBBL / WBL /
  TGIFBL).
- **OBS remote control** — queue-based bridge: web ops enqueues
  commands, on-site `obs-agent` pulls + acks via Bearer
  `OBS_AGENT_TOKEN`. Supports stream/record start/stop, scene switch,
  source visibility, filter toggle, text update, browser refresh.
- **Gamification leaderboard RPC** — `get_gamification_leaderboard`
  aggregates points per user with display name join.
- **Auto-overlay trigger** — `trg_ensure_overlay_state` creates an
  overlay row on every new `games` insert so the OBS source never
  404s on a fresh game.
- **Route registration tests** — 15 new assertions in
  `worker-overlay-engagement-routes.test.ts` guard the route table.

All new tables RLS-enabled with policies scoped to the live `app_role`
enum (`super_admin`, `league_admin`, `team_manager`, `media_operator`).

Migration `supabase/migrations/20260417100000_overlay_engagement_sponsor_digest.sql`
applied to project `ezanilxygnpucwkwpsoc` on 2026-04-17 — 10 tables
created, 17 existing games backfilled with overlay state rows, 1 RPC
and 1 trigger installed. Full validation evidence in
[`docs/features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md`](docs/features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md).

Gates on 2026-04-17: typecheck clean · lint 0/0 · vitest 745 passed ·
production build OK (4 new chunks).

## 2026-04-16 — v1.1.0 — Documentation Audit & Consolidation

- Audited every document in the repository root and under `docs/`.
- Removed superseded specs: `docs/features/STREAM_GATING_v1.4.0.md` (replaced by v1.5.0) and `docs/quality/LIVESTREAM_WORKFLOW_AUDIT_2026-04-04.md` (replaced by the 2026-04-09 integrity audit).
- Renamed unversioned architecture docs under `docs/architecture/` with standard `_vX.Y.Z.md` suffix:
  - `CANONICAL_DATA_PIPELINE` → `architecture/CANONICAL_DATA_PIPELINE_v1.0.0.md`
  - `COMPLETE_CODEBASE_MAP.md` → `architecture/COMPLETE_CODEBASE_MAP_v1.0.0.md`
  - `api_contracts.md` → `architecture/STORE_API_CONTRACTS_v1.0.0.md`
  - `store_architecture.md` → `architecture/STORE_ARCHITECTURE_v1.0.0.md`
- Renamed quality docs to include version suffix and added standard front-matter:
  - `LIVESTREAM_INGEST_BROADCAST_SYSTEM_INTEGRITY_AUDIT_2026-04-09.md` → `_v1.0.0.md`
  - `MEDIA_PUBLICATIONS_SORT_ORDER_MIGRATION_2026-04-16.md` → `_v1.0.0.md`
  - `PRODUCTION_ENV_VERIFICATION_2026-04-15.md` → `_v1.0.0.md`
- Added `<!-- Version | Date | Status -->` front-matter to all docs previously missing it.
- Rewrote `README.md` doc links — every target now points at an existing file at its current version.
- Rewrote `docs/README.md` master index — reflects actual on-disk file set, adds Agents section, links root-level policy docs (ONE_DEVICE, PAYWALL, RESUME, STREAM_TEST_STRATEGY).

## 2026-04-16 — v1.0-store-canonicalization-hardening

- Standardized the database schema on `store_products`, `store_orders`, and `custom_quote_requests`.
- Implemented robust server-side webhook syncing for store orders.
- Removed mock data paths from UI and properly fetched via Edge Workers.
- Enforced strict IDEMPOTENCY KEY propagation.
- Canonicalized internal API data maps.
