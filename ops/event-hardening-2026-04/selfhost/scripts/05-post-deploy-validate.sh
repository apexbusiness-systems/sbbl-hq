#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 05-post-deploy-validate.sh
# Post-deployment validation gates for the self-hosted Supabase deployment.
# Run after DNS cutover to verify all services are healthy.
#
# Usage:
#   ./05-post-deploy-validate.sh [DOMAIN]
#
# Default domain: sbbl-hq.icu
###############################################################################

DOMAIN="${1:-sbbl-hq.icu}"
BASE_URL="https://${DOMAIN}"
PASS=0
FAIL=0

check() {
    local label="$1"
    local result="$2"
    local expected="$3"

    if echo "$result" | grep -qi "$expected"; then
        echo "  ✓ ${label}"
        PASS=$((PASS + 1))
    else
        echo "  ✗ ${label} (expected: ${expected}, got: ${result})"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== SBBL-HQ Post-Deploy Validation ==="
echo "Target: ${BASE_URL}"
echo "Time:   $(date -Iseconds)"
echo ""

# ── Phase 1: HTTP smoke tests ──────────────────────────────────────────────
echo "── HTTP Smoke Tests ──"

REST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/rest/v1/" 2>/dev/null || echo "000")
check "REST API responds" "$REST_STATUS" "200"

AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/auth/v1/health" 2>/dev/null || echo "000")
check "Auth health endpoint" "$AUTH_STATUS" "200"

LIVE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/live" 2>/dev/null || echo "000")
check "Live page accessible" "$LIVE_STATUS" "200"

echo ""

# ── Phase 2: TLS verification ──────────────────────────────────────────────
echo "── TLS Verification ──"

TLS_RESULT=$(curl -vI "${BASE_URL}" 2>&1 | grep -i "SSL certificate\|subject:" || echo "no-tls")
check "TLS certificate valid" "$TLS_RESULT" "SSL"

echo ""

# ── Phase 3: Database connectivity (via SSH tunnel) ────────────────────────
echo "── Database Checks (requires SSH tunnel or local access) ──"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/sbbl-hq-key.pem}"
PRIMARY_HOST="${PRIMARY_HOST:-52.21.231.157}"

if [[ -f "$SSH_KEY" ]]; then
    # Check archive_mode
    ARCHIVE_MODE=$(ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
        "ubuntu@${PRIMARY_HOST}" \
        'sudo docker exec supabase-db psql -U postgres -t -c "SHOW archive_mode;"' 2>/dev/null | tr -d ' ' || echo "unknown")
    check "archive_mode = on" "$ARCHIVE_MODE" "on"

    # Check replication status
    REPL_COUNT=$(ssh -i "$SSH_KEY" -o ConnectTimeout=5 \
        "ubuntu@${PRIMARY_HOST}" \
        'sudo docker exec supabase-db psql -U postgres -t -c "SELECT count(*) FROM pg_stat_replication;"' 2>/dev/null | tr -d ' ' || echo "0")
    if [[ "$REPL_COUNT" -ge 1 ]] 2>/dev/null; then
        echo "  ✓ Streaming replication active (${REPL_COUNT} replica(s))"
        PASS=$((PASS + 1))
    else
        echo "  ✗ No active replication connections (count: ${REPL_COUNT})"
        FAIL=$((FAIL + 1))
    fi

    # Check PgBouncer pool
    POOL_STATUS=$(ssh -i "$SSH_KEY" -o ConnectTimeout=5 \
        "ubuntu@${PRIMARY_HOST}" \
        'sudo docker exec supabase-db psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = '\''active'\'';"' 2>/dev/null | tr -d ' ' || echo "unknown")
    echo "  ℹ Active DB connections: ${POOL_STATUS}"
else
    echo "  ⊘ Skipped: SSH key not found at ${SSH_KEY}"
    echo "    Set SSH_KEY=/path/to/key to enable DB checks."
fi

echo ""

# ── Phase 4: Replication lag ───────────────────────────────────────────────
echo "── Replication Lag ──"

if [[ -f "$SSH_KEY" ]]; then
    REPL_LAG=$(ssh -i "$SSH_KEY" -o ConnectTimeout=5 \
        "ubuntu@${PRIMARY_HOST}" \
        'sudo docker exec supabase-db psql -U postgres -t -c "SELECT COALESCE(max(replay_lag)::text, '\''no replicas'\'') FROM pg_stat_replication;"' 2>/dev/null | tr -d ' ' || echo "unknown")
    echo "  ℹ Replay lag: ${REPL_LAG}"

    if [[ "$REPL_LAG" == "no replicas" ]] || [[ "$REPL_LAG" == "unknown" ]]; then
        echo "  ⊘ Cannot check replication lag (no replicas connected)"
    fi
else
    echo "  ⊘ Skipped: SSH key not found"
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo "=== Summary ==="
echo "Passed: ${PASS}/${TOTAL}"
echo "Failed: ${FAIL}/${TOTAL}"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo "⚠ Some checks failed. Review output above before proceeding."
    exit 1
else
    echo "All checks passed."
    exit 0
fi
