#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 11-verify-backup.sh
# Verifies a backup by restoring into a temporary database and running checks
#
# Usage: ./11-verify-backup.sh [path-to-dump-file]
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$(dirname "$PROJECT_DIR")/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/11-verify-backup-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }

# ── Configuration ────────────────────────────────────────────────────────────
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-supabase_admin}"
TEST_DB="restore_test"

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" ]]; then
    # Default to the most recent backup
    BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_DIR}/backups}"
    DUMP_FILE=$(find "$BACKUP_ROOT" -name '*.dump' -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)
    if [[ -z "$DUMP_FILE" ]]; then
        log "ERROR: No dump file specified and no backups found in ${BACKUP_ROOT}"
        exit 1
    fi
fi

log "Verifying backup: ${DUMP_FILE}"

# ── Cleanup function ────────────────────────────────────────────────────────
cleanup() {
    log "Cleaning up: dropping ${TEST_DB}..."
    docker exec "$DB_CONTAINER" \
        psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null || true
}
trap cleanup EXIT

# ── Create test database ─────────────────────────────────────────────────────
log "Creating test database '${TEST_DB}'..."
docker exec "$DB_CONTAINER" \
    psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
docker exec "$DB_CONTAINER" \
    psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TEST_DB};"

# ── Restore backup ──────────────────────────────────────────────────────────
log "Restoring dump into ${TEST_DB}..."
docker cp "$DUMP_FILE" "${DB_CONTAINER}:/tmp/verify.dump"
docker exec "$DB_CONTAINER" \
    pg_restore -U "$DB_USER" -d "$TEST_DB" \
    --no-owner --no-privileges \
    /tmp/verify.dump 2>&1 | tee -a "$LOG_FILE"

# ── Verify with queries ─────────────────────────────────────────────────────
log "Running verification queries..."

TABLE_COUNT=$(docker exec "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$TEST_DB" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog');")
log "Tables restored: ${TABLE_COUNT}"

if [[ "$TABLE_COUNT" -gt 0 ]]; then
    # Try to count auth users if the schema exists
    AUTH_COUNT=$(docker exec "$DB_CONTAINER" \
        psql -U "$DB_USER" -d "$TEST_DB" -t -A -c \
        "SELECT count(*) FROM auth.users;" 2>/dev/null || echo "N/A")
    log "auth.users count: ${AUTH_COUNT}"

    log "SUCCESS: Backup verification passed (${TABLE_COUNT} tables restored)"
    exit 0
else
    log "ERROR: No tables found after restore -- backup may be corrupt"
    exit 1
fi
