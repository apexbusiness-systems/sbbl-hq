<!-- Version: v1.0.0 | Date: 2026-04-18 | Status: Current -->
# Supabase Migration Drift Repair

Reconciles `supabase/migrations/` (local) with `supabase_migrations.schema_migrations` (prod)
after drift caused by Dashboard / SQL-editor DDL that bypassed the migration
directory. Supabase Preview CI fails when the two disagree:

> Remote migration versions not found in local migrations directory.

## Drift taxonomy

1. **Remote-only** — row exists in prod `schema_migrations` with a name that
   matches no local file. Fix: `supabase db pull` emits a single catch-up
   migration capturing the current prod schema that isn't represented by any
   local file.
2. **Name-match pairs** — local file `<local_ts>_<name>.sql` exists and a
   remote row with the same `name` exists at a different `<remote_ts>`. The
   DDL was applied to prod (under the remote timestamp) but the local file
   was authored later. Fix: rewrite `schema_migrations` so the row carries
   the local timestamp. `supabase migration repair` does this *without*
   re-running SQL.
3. **Local-only** — local file with a name that has no remote row. Fix:
   ordinary `supabase db push` applies them on next deploy.

## Runbook

Prereqs: access to the prod Postgres connection string (pooler URI with
password). Export as `SUPABASE_DB_URL`. Never commit it.

```bash
export SUPABASE_DB_URL='postgres://...pooler.supabase.com:6543/postgres'

# 1. Dry-run (prints the plan — name-match pairs, remote-only, local-only).
./scripts/repair-migration-drift.sh

# 2. Review the plan. Every row listed under "name-match drift pairs"
#    must correspond to DDL that is *already present* in prod. If a row
#    looks wrong, stop and investigate — do not apply.

# 3. Apply.
APPLY=1 ./scripts/repair-migration-drift.sh
```

The script:

1. Backs up `supabase/migrations/` to `supabase/migrations.backup-YYYY-MM-DD/`.
2. Dumps `supabase_migrations` (data-only) to
   `supabase/migrations.remote-snapshot-YYYY-MM-DD.sql` for rollback.
3. Enumerates `schema_migrations` via psql and computes the three drift
   sets.
4. For each name-match pair runs, in order:
   - `supabase migration repair --status reverted <remote_version>`
   - `supabase migration repair --status applied  <local_version>`
5. Runs `supabase db pull` to emit the catch-up file for remote-only
   migrations.
6. Runs `supabase db diff --schema public`. Expected output: *No schema
   changes found.* Anything else means residual drift — do not merge.

Commit the backup directory is **not** required; git history already
serves that role. The snapshot `.sql` should be gitignored; keep a copy
locally until the PR lands.

## What NOT to do

- `supabase db reset` against prod — wipes data.
- `DELETE FROM supabase_migrations.schema_migrations` — Supabase treats a
  missing row as "migration still needs to run," so the next `db push`
  may attempt already-applied DDL and hit `already exists` errors on
  policies, triggers, and tables.
- `git rm` on existing migration files — they are immutable once merged
  (CLAUDE.md hard rule); downstream dev environments may rely on them.
- Editing existing migration filenames to match remote timestamps —
  same rule; changes the hash and breaks every other dev's state.

## Rollback

```bash
# Restore remote schema_migrations from the snapshot.
psql "$SUPABASE_DB_URL" -f supabase/migrations.remote-snapshot-YYYY-MM-DD.sql

# Restore local files.
rm -rf supabase/migrations
mv supabase/migrations.backup-YYYY-MM-DD supabase/migrations
```

## Prevention

- Author every schema change as a dated migration under
  `supabase/migrations/` **before** applying it. Never use the
  Dashboard SQL editor for DDL against prod.
- `npm run db:migrate` (= `supabase db push`) is the only sanctioned
  path to apply migrations.
- CI runs `supabase db diff` on every PR; red diff blocks merge.
