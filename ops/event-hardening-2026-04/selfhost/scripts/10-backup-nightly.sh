#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 10-backup-nightly.sh
# Creates a nightly pg_dump backup of the Supabase database via docker
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$(dirname "$PROJECT_DIR")/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/10-backup-nightly-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_DIR}/backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

DATE_TAG=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${DATE_TAG}"
DUMP_FILE="supabase-${DATE_TAG}.dump"

mkdir -p "$BACKUP_DIR"

# ── Create backup ────────────────────────────────────────────────────────────
log "Starting backup of database '${POSTGRES_DB}' from container '${DB_CONTAINER}'..."

docker exec "$DB_CONTAINER" \
    pg_dump -U supabase_admin -Fc --no-owner --no-privileges "$POSTGRES_DB" \
    > "${BACKUP_DIR}/${DUMP_FILE}"

DUMP_SIZE=$(stat -c%s "${BACKUP_DIR}/${DUMP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${DUMP_FILE}")
DUMP_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", ${DUMP_SIZE}/1048576}")

log "Backup complete: ${BACKUP_DIR}/${DUMP_FILE} (${DUMP_SIZE_MB} MB)"

# ── Rotate old backups ──────────────────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS} days..."
PRUNED=0
if [[ -d "$BACKUP_ROOT" ]]; then
    while IFS= read -r -d '' old_dir; do
        log "  Removing: ${old_dir}"
        rm -rf "$old_dir"
        PRUNED=$((PRUNED + 1))
    done < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print0)
fi
log "Pruned ${PRUNED} old backup(s)"

log "Nightly backup completed successfully"
