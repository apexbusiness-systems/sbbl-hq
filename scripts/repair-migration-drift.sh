#!/usr/bin/env bash
# Supabase migration drift repair — SBBL-HQ
#
# Reconciles supabase_migrations.schema_migrations (remote bookkeeping) with
# the local supabase/migrations/ directory. Safe by default: every mutating
# step is gated behind APPLY=1. Without APPLY=1 the script runs in dry-run
# mode and prints the planned operations.
#
# Required environment:
#   SUPABASE_DB_URL   postgres:// connection string for the target project
#                     (pooler URI, include password). Read/write.
#
# Optional environment:
#   PROJECT_REF       defaults to ezanilxygnpucwkwpsoc (sbbl-hq prod)
#   APPLY             set to 1 to execute; otherwise dry-run only
#
# Exit codes: 0 = clean, non-zero = drift remaining or error.
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-ezanilxygnpucwkwpsoc}"
APPLY="${APPLY:-0}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$REPO_ROOT/supabase/migrations"
STAMP="$(date +%F)"
BACKUP_DIR="$REPO_ROOT/supabase/migrations.backup-$STAMP"
SNAPSHOT_FILE="$REPO_ROOT/supabase/migrations.remote-snapshot-$STAMP.sql"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is required (postgres:// connection string)" >&2
  exit 2
fi

run() {
  if [[ "$APPLY" == "1" ]]; then
    echo "+ $*"
    eval "$@"
  else
    echo "dry-run: $*"
  fi
}

echo "=== Step 1: snapshot local + remote ==="
if [[ -d "$BACKUP_DIR" ]]; then
  echo "backup already exists: $BACKUP_DIR (skipping)"
else
  run "cp -r '$MIG_DIR' '$BACKUP_DIR'"
fi

# Remote bookkeeping snapshot (data-only). Always safe; no-op on dry-run.
run "npx supabase db dump --db-url '$SUPABASE_DB_URL' --schema supabase_migrations --data-only > '$SNAPSHOT_FILE'"

echo
echo "=== Step 2: enumerate remote schema_migrations ==="
# columns: version (timestamp string), name (filename stem without timestamp)
REMOTE_CSV="$(mktemp)"
trap 'rm -f "$REMOTE_CSV"' EXIT
psql "$SUPABASE_DB_URL" -At -F $'\t' -c \
  "select version, name from supabase_migrations.schema_migrations order by version" \
  > "$REMOTE_CSV"
echo "remote rows: $(wc -l < "$REMOTE_CSV")"

echo
echo "=== Step 3: compute drift ==="
# Build "version<TAB>name" for local files too. Filenames are
# <version>_<name>.sql — version is the numeric prefix, name is the rest
# without the .sql extension.
LOCAL_CSV="$(mktemp)"
trap 'rm -f "$REMOTE_CSV" "$LOCAL_CSV"' EXIT
for f in "$MIG_DIR"/*.sql; do
  base="$(basename "$f" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  printf '%s\t%s\n' "$version" "$name" >> "$LOCAL_CSV"
done
echo "local rows: $(wc -l < "$LOCAL_CSV")"

# name-match pairs: same name, different version.
# Emits: local_version<TAB>remote_version<TAB>name
PAIRS="$(mktemp)"
trap 'rm -f "$REMOTE_CSV" "$LOCAL_CSV" "$PAIRS"' EXIT
awk -F'\t' 'NR==FNR { remote[$2]=$1; next } $2 in remote && remote[$2]!=$1 { print $1"\t"remote[$2]"\t"$2 }' \
  "$REMOTE_CSV" "$LOCAL_CSV" > "$PAIRS"

# remote-only: in remote, no local file at any version with that name.
REMOTE_ONLY="$(mktemp)"
trap 'rm -f "$REMOTE_CSV" "$LOCAL_CSV" "$PAIRS" "$REMOTE_ONLY"' EXIT
awk -F'\t' 'NR==FNR { local_names[$2]=1; next } !($2 in local_names) { print $1"\t"$2 }' \
  "$LOCAL_CSV" "$REMOTE_CSV" > "$REMOTE_ONLY"

# local-only: local file with name that has no remote row at any version.
LOCAL_ONLY="$(mktemp)"
trap 'rm -f "$REMOTE_CSV" "$LOCAL_CSV" "$PAIRS" "$REMOTE_ONLY" "$LOCAL_ONLY"' EXIT
awk -F'\t' 'NR==FNR { remote_names[$2]=1; next } !($2 in remote_names) { print $1"\t"$2 }' \
  "$REMOTE_CSV" "$LOCAL_CSV" > "$LOCAL_ONLY"

echo "name-match drift pairs: $(wc -l < "$PAIRS")"
echo "remote-only migrations: $(wc -l < "$REMOTE_ONLY")"
echo "local-only migrations:  $(wc -l < "$LOCAL_ONLY")"

if [[ -s "$PAIRS" ]]; then
  echo
  echo "--- name-match pairs (local_version  remote_version  name) ---"
  column -t -s $'\t' "$PAIRS"
fi
if [[ -s "$REMOTE_ONLY" ]]; then
  echo
  echo "--- remote-only (will be pulled via db pull) ---"
  column -t -s $'\t' "$REMOTE_ONLY"
fi
if [[ -s "$LOCAL_ONLY" ]]; then
  echo
  echo "--- local-only (will be pushed on next db push) ---"
  column -t -s $'\t' "$LOCAL_ONLY"
fi

echo
echo "=== Step 4: repair name-match pairs ==="
# Strategy per pair:
#   1. repair --status reverted <remote_version>  (removes bogus remote row)
#   2. repair --status applied  <local_version>   (inserts correct row)
# This never re-runs SQL; it only rewrites supabase_migrations.schema_migrations.
# Preconditions: the DDL is already present in prod — we verified by the fact
# that the remote row exists for the same name.
while IFS=$'\t' read -r local_version remote_version name; do
  [[ -z "$local_version" ]] && continue
  echo "repairing: $name  (remote $remote_version -> local $local_version)"
  run "npx supabase migration repair --db-url '$SUPABASE_DB_URL' --status reverted '$remote_version'"
  run "npx supabase migration repair --db-url '$SUPABASE_DB_URL' --status applied  '$local_version'"
done < "$PAIRS"

echo
echo "=== Step 5: pull remote-only migrations ==="
if [[ -s "$REMOTE_ONLY" ]]; then
  # db pull writes ONE catch-up file capturing the current prod schema that
  # isn't represented by any local migration. Commit the emitted file as-is.
  run "npx supabase db pull --db-url '$SUPABASE_DB_URL'"
else
  echo "no remote-only migrations; skipping db pull"
fi

echo
echo "=== Step 6: verify ==="
# Prod should now diff clean. Any output here indicates residual drift.
if [[ "$APPLY" == "1" ]]; then
  if npx supabase db diff --db-url "$SUPABASE_DB_URL" --schema public; then
    echo "✅ supabase db diff clean — drift repaired"
  else
    echo "❌ db diff still reports changes — inspect manually" >&2
    exit 1
  fi
else
  echo "dry-run: skipping db diff verification"
fi

echo
echo "Done. Commit new files under supabase/migrations/ (the db pull output)"
echo "and open a PR to land the reconciled state."
