#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 12-prune-backups.sh
# Removes backup directories older than 30 days (or RETENTION_DAYS)
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$(dirname "$PROJECT_DIR")/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/12-prune-backups-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ ! -d "$BACKUP_ROOT" ]]; then
    log "Backup directory does not exist: ${BACKUP_ROOT}"
    log "Nothing to prune."
    exit 0
fi

log "Pruning backups older than ${RETENTION_DAYS} days from ${BACKUP_ROOT}..."

PRUNED=0
TOTAL_FREED=0

while IFS= read -r -d '' old_dir; do
    DIR_SIZE=$(du -sb "$old_dir" 2>/dev/null | cut -f1 || echo 0)
    log "  Removing: ${old_dir} ($(awk "BEGIN {printf \"%.2f\", ${DIR_SIZE}/1048576}") MB)"
    rm -rf "$old_dir"
    PRUNED=$((PRUNED + 1))
    TOTAL_FREED=$((TOTAL_FREED + DIR_SIZE))
done < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print0)

FREED_MB=$(awk "BEGIN {printf \"%.2f\", ${TOTAL_FREED}/1048576}")

log "Pruned ${PRUNED} backup(s), freed ${FREED_MB} MB"
log "Prune completed successfully"
