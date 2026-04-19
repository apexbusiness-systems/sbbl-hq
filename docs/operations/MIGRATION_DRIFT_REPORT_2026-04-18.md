<!-- Version: v1.0.0 | Date: 2026-04-18 | Status: Active incident -->
# Migration Drift Report — 2026-04-18

Snapshot of `supabase_migrations.schema_migrations` (prod, project
`ezanilxygnpucwkwpsoc`) compared against `supabase/migrations/` on
`main@2526dec`.

Paired with `scripts/repair-migration-drift.sh` and
`docs/operations/MIGRATION_DRIFT_REPAIR_v1.0.0.md`. This document
captures the findings; the repair script consumes them.

## Totals

| Category | Count | Disposition |
|---|---|---|
| Matched (in sync) | 26 | no action |
| Name-match drift (diff timestamps) | 16 | `repair --status reverted <remote>` + `--status applied <local>` |
| Remote-only (no local file) | 7 | `supabase db pull` catch-up migration |
| Local-only (no remote row) | 16 | **manual review** — see below |
| Duplicate local filename | 1 pair | **manual review** — see below |

The task write-up quoted **23 remote-only / 32 name-match**. The live
database does not match those numbers; use the ones above.

## Name-match drift — 16 pairs

Local file timestamp → remote `schema_migrations.version` row, same
name stem. The DDL is already present in prod under the remote
timestamp; we only need to rewrite the bookkeeping.

| Local version | Remote version | Name |
|---|---|---|
| 20260411120000 | 20260411033708 | grant_sbblhqapp_super_admin |
| 20260411130000 | 20260411033757 | super_admin_comp_codes |
| 20260415000000 | 20260416223018 | add_stream_url_to_games |
| 20260415093000 | 20260416223032 | fix_tgif_potg_league_reclassification |
| 20260415143000 | 20260416223107 | backfill_tgif_potg_tabulation |
| 20260415153000 | 20260416223125 | fix_tgif_potg_backfill_vs_split |
| 20260415160000 | 20260416223137 | backfill_tgif_potg_unmatched_players |
| 20260415170000 | 20260416223142 | media_publications_sort_order |
| 20260415180000 | 20260416223155 | store_v1_launch |
| 20260416090000 | 20260416223219 | media_publications_sort_order_nullable_default |
| 20260416120000 | 20260416223239 | store_products_league_id |
| 20260416220000 | 20260416223429 | backfill_stats_from_media_publications |
| 20260416230000 | 20260416223543 | stats_dashboard_league_filter |
| 20260416240000 | 20260417020358 | seed_store_products_canonical_catalog |
| 20260417100000 | 20260417011026 | overlay_engagement_sponsor_digest |
| 20260417110000 | 20260417052526 | stats_dashboard_include_avatar_url |

## Remote-only — 7 rows

In prod `schema_migrations` with no corresponding local file. `db pull`
will emit a single catch-up migration capturing the schema these
represent; inspect the generated file before merging.

| Version | Name |
|---|---|
| 20260407134155 | media_publications_ingest_jobs |
| 20260410111544 | create_media_ingest_bucket |
| 20260411164357 | stream_admin_config_public_read |
| 20260411164406 | stream_entitlements_auth_self_read |
| 20260416223213 | store_v1_hardening_a |
| 20260416223234 | store_v1_hardening_b |
| 20260417014834 | omnihub_command_log_v1_6_0 |

## Local-only — 16 files (manual review required)

These files exist locally with no matching row in
`schema_migrations`. The default handling suggested by the runbook
("apply via next `db push`") is **not safe here** — most of these
look like they are already present in prod (stats, ingest, and stream
subsystems the app relies on). Naive `db push` would re-run the DDL
and hit `already exists` errors.

Before applying any of these, the operator must inspect each one and
decide:

- DDL **is** already in prod → `migration repair --status applied
  <local_version>` to record the row (no SQL re-run).
- DDL **is not** yet in prod → `db push` will apply it on next deploy.

| Version | Name |
|---|---|
| 20260404002000 | stream_reactions |
| 20260404003000 | teams_seed_data |
| 20260404004000 | scores_categories |
| 20260404250000 | wbl_game_scores_seed |
| 20260405000100 | stream_session_unique_constraint |
| 20260406000100 | heartbeat_batch_upsert_function |
| 20260406000200 | stream_session_max_expires_at |
| 20260407103137 | media_publications |
| 20260407200000 | ingest_pipeline |
| 20260409180000 | security_hardening_ingest_and_standings |
| 20260409213000 | followup_ingest_rls_policy_and_mvw_lockdown |
| 20260410120000 | stream_validation_system |
| 20260411100000 | stream_shared_rate_limit |
| 20260416000000 | store_v1_hardening **(duplicate — see below)** |
| 20260416100000 | store_v1_hardening **(duplicate — see below)** |
| 20260417140000 | broadcast_integration |

## Duplicate local filename — `store_v1_hardening`

Two local files share the exact same name stem:

- `supabase/migrations/20260416000000_store_v1_hardening.sql`
- `supabase/migrations/20260416100000_store_v1_hardening.sql`

Prod has two disambiguated rows suggesting someone renamed them when
applying via Dashboard:

- `20260416223213` — `store_v1_hardening_a`
- `20260416223234` — `store_v1_hardening_b`

Hypothesized mapping (requires confirmation by reading the SQL bodies):

- local `20260416000000` → remote `store_v1_hardening_a` (`20260416223213`)
- local `20260416100000` → remote `store_v1_hardening_b` (`20260416223234`)

Two options:

1. **Rename locally to match prod.** Violates the CLAUDE.md rule
   ("NEVER edit an existing [migration] — they are immutable once
   merged"), but is the only path that makes `db diff` green without
   touching prod. Downstream dev env breakage risk.
2. **Rewrite the remote rows to the local names.** Same-name collision
   in prod is forbidden by the `schema_migrations` PK on `version`, so
   this means two `repair` operations that both land as
   `store_v1_hardening` — also a collision unless we keep the names as
   `store_v1_hardening_a` / `_b` and rename the local files to match.

Either way, human judgement required. Do **not** auto-repair this
pair.

## Recommended execution order

1. Operator exports `SUPABASE_DB_URL` (pooler URI with password).
2. Dry-run: `./scripts/repair-migration-drift.sh` — confirm the 16
   pairs above appear and the script's enumeration matches this
   report.
3. Apply the 16 name-match repairs: `APPLY=1
   ./scripts/repair-migration-drift.sh`. The script will also run
   `db pull` for the 7 remote-only rows and emit one catch-up file.
4. Commit the `db pull` output under `supabase/migrations/`.
5. For each of the 16 local-only files: inspect prod (`\d table`,
   `\df function`, `select exists(...)`) to confirm whether the DDL
   is already applied, then either repair-as-applied or let `db push`
   take it.
6. Resolve the `store_v1_hardening` duplicate manually.
7. Verify: `npx supabase db diff --schema public` — must print "No
   schema changes found."
8. CI's Supabase Preview step should now go green.

## Blocker for this session

This session has Management API SQL access (read+write via
`https://api.supabase.com/v1/projects/<ref>/database/query`) but
**no pooler URI with password**, so the Supabase CLI (`db pull`,
`migration repair`, `db diff`) cannot be invoked. Handoff to an
operator with pooler credentials; they can run the script directly.
