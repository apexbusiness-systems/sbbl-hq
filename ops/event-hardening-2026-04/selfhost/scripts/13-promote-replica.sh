#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 13-promote-replica.sh
# Promotes the PostgreSQL hot-standby replica to primary.
# Run this during a failover when the primary EC2 is unreachable.
#
# Usage:
#   ./13-promote-replica.sh [--dry-run]
#
# What this does:
#   1. Verifies primary is truly down (optional safety check)
#   2. Promotes replica via pg_promote() or pg_ctl promote
#   3. Verifies replica is no longer in recovery
#   4. Updates Cloudflare DNS A record to replica IP
#   5. Prints post-promotion checklist
#
# Environment variables:
#   SSH_KEY        - path to PEM key (default: ~/.ssh/sbbl-hq-key.pem)
#   PRIMARY_HOST   - primary EC2 public IP (default: 52.21.231.157)
#   REPLICA_HOST   - replica EC2 public IP (default: 3.83.9.123)
#   CF_ZONE_ID     - Cloudflare zone ID (required)
#   CF_API_TOKEN   - Cloudflare API token (required)
###############################################################################

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && { DRY_RUN=true; echo "[DRY RUN] No changes will be made."; }

# ── Configuration ────────────────────────────────────────────────────────────
SSH_KEY="${SSH_KEY:-$HOME/.ssh/sbbl-hq-key.pem}"
SSH_USER="ubuntu"
SSH_OPTS="-i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
PRIMARY_HOST="${PRIMARY_HOST:-52.21.231.157}"
REPLICA_HOST="${REPLICA_HOST:-3.83.9.123}"
DOMAIN="sbbl-hq.icu"
CF_ZONE_ID="${CF_ZONE_ID:-}"
CF_API_TOKEN="${CF_API_TOKEN:-}"

# Docker container name for supabase-db on replica
DB_CONTAINER="supabase-db"
# Data directory inside the container
PG_DATA="/var/lib/postgresql/data"

die() { echo "ERROR: $*" >&2; exit 1; }
run_ssh() {
  local host="$1"; shift
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] ssh ${host}: $*"
  else
    ssh $SSH_OPTS "${SSH_USER}@${host}" "$@"
  fi
}

echo "=== SBBL-HQ Replica Promotion ==="
echo "Primary:  ${PRIMARY_HOST}"
echo "Replica:  ${REPLICA_HOST}"
echo ""

[[ ! -f "$SSH_KEY" ]] && die "SSH key not found: ${SSH_KEY}"

# ── Step 1: Confirm primary is unreachable (safety gate) ──────────────────────
echo "[1/5] Checking primary availability..."
if ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" "echo 'ok'" 2>/dev/null; then
  echo ""
  echo "  WARNING: Primary EC2 ${PRIMARY_HOST} is still reachable!"
  echo "  Promoting a replica while the primary is alive risks split-brain."
  echo ""
  read -r -p "  Are you sure you want to proceed? Type YES to continue: " CONFIRM
  [[ "$CONFIRM" != "YES" ]] && { echo "Aborted."; exit 1; }
else
  echo "  ✓ Primary is unreachable — safe to promote"
fi

# ── Step 2: Verify replica is in standby mode ──────────────────────────────
echo "[2/5] Checking replica standby status..."
if [[ "$DRY_RUN" == false ]]; then
  IN_RECOVERY=$(ssh $SSH_OPTS "${SSH_USER}@${REPLICA_HOST}" \
    "docker exec ${DB_CONTAINER} psql -U postgres -tAc 'SELECT pg_is_in_recovery();'" 2>/dev/null || echo "error")
  if [[ "$IN_RECOVERY" == "t" ]]; then
    echo "  ✓ Replica is in standby mode (pg_is_in_recovery = t)"
  elif [[ "$IN_RECOVERY" == "f" ]]; then
    die "Replica reports pg_is_in_recovery = f. It is already a primary. Aborting."
  else
    echo "  ⚠ Could not determine replica state (got: '${IN_RECOVERY}'). Proceeding with caution."
  fi
fi

# ── Step 3: Promote the replica ────────────────────────────────────────────
echo "[3/5] Promoting replica to primary..."
if [[ "$DRY_RUN" == false ]]; then
  # Use pg_promote() (PostgreSQL 12+) via SQL
  PROMOTE_RESULT=$(ssh $SSH_OPTS "${SSH_USER}@${REPLICA_HOST}" \
    "docker exec ${DB_CONTAINER} psql -U postgres -tAc 'SELECT pg_promote();'" 2>&1 || true)
  echo "  pg_promote() result: ${PROMOTE_RESULT}"

  # Wait up to 30s for promotion to complete
  echo -n "  Waiting for promotion..."
  for i in $(seq 1 30); do
    sleep 1
    IS_PRIMARY=$(ssh $SSH_OPTS "${SSH_USER}@${REPLICA_HOST}" \
      "docker exec ${DB_CONTAINER} psql -U postgres -tAc 'SELECT pg_is_in_recovery();'" 2>/dev/null || echo "error")
    if [[ "$IS_PRIMARY" == "f" ]]; then
      echo " done (${i}s)"
      break
    fi
    echo -n "."
    if [[ $i -eq 30 ]]; then
      echo ""
      die "Replica did not promote within 30s. Check container logs: docker logs ${DB_CONTAINER}"
    fi
  done
  echo "  ✓ Replica promoted to primary"
else
  echo "[dry-run] Would promote ${REPLICA_HOST}:${DB_CONTAINER} via pg_promote()"
fi

# ── Step 4: Update Cloudflare DNS to point to replica ───────────────────────
echo "[4/5] Updating DNS ${DOMAIN} → ${REPLICA_HOST}..."
if [[ -n "$CF_ZONE_ID" ]] && [[ -n "$CF_API_TOKEN" ]]; then
  RECORD_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${DOMAIN}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" | \
    python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null || true)

  if [[ -n "$RECORD_ID" ]]; then
    if [[ "$DRY_RUN" == false ]]; then
      DNS_RESP=$(curl -s -X PUT \
        "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"${DOMAIN}\",\"content\":\"${REPLICA_HOST}\",\"ttl\":60,\"proxied\":true}")
      echo "$DNS_RESP" | grep -q '"success":true' && \
        echo "  ✓ DNS updated: ${DOMAIN} → ${REPLICA_HOST}" || \
        echo "  ⚠ DNS update may have failed. Check CF dashboard. Response: $DNS_RESP"
    else
      echo "[dry-run] PUT dns_records/${RECORD_ID} — ${DOMAIN} → ${REPLICA_HOST}"
    fi
  else
    echo "  ⚠ No existing A record found. Update DNS manually: ${DOMAIN} → ${REPLICA_HOST}"
  fi
else
  echo "  ⚠ CF_ZONE_ID or CF_API_TOKEN not set — update DNS manually"
  echo "     ${DOMAIN} A ${REPLICA_HOST}"
fi

# ── Step 5: Post-promotion checklist ──────────────────────────────────────
echo ""
echo "[5/5] Post-Promotion Checklist:"
echo "  [ ] Verify app is working: https://${DOMAIN}/auth/v1/"
echo "  [ ] Verify pg_is_in_recovery() = f on new primary"
echo "  [ ] Drop old replication slot on new primary:"
echo "        docker exec ${DB_CONTAINER} psql -U postgres -c \"SELECT pg_drop_replication_slot('replica_1');\""
echo "  [ ] Remove standby.signal if still present:"
echo "        docker exec ${DB_CONTAINER} rm -f ${PG_DATA}/standby.signal"
echo "  [ ] Update SUPABASE_URL Worker secret if primary IP was embedded"
echo "  [ ] Once old primary is recovered, re-configure it as a new replica"
echo "  [ ] Create a fresh EBS snapshot of promoted primary immediately"
echo "  [ ] Notify team: replica ${REPLICA_HOST} is now primary"
echo ""
echo "=== Promotion complete ($(date -u '+%Y-%m-%dT%H:%M:%SZ')) ==="
