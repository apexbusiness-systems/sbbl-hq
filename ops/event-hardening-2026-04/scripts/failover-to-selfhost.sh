#!/usr/bin/env bash
# =============================================================================
# SBBL-HQ — Restore: Supabase Cloud → Self-Hosted EC2
# Run from ANYWHERE with internet access.
# Usage: FAILOVER_SECRET=xxx bash failover-to-selfhost.sh
# SAFETY: Verifies self-hosted is healthy BEFORE switching traffic.
# =============================================================================
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELFHOST_DIR="$SCRIPTS_DIR/../selfhost"
ENV_FILE="$SELFHOST_DIR/.env"

API_PROXY="https://api.sbbl-hq.icu/ops/failover"
SELFHOST_HEALTH_PATH="/auth/v1/health"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ → Restoring Self-Hosted Primary"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Resolve FAILOVER_SECRET ────────────────────────────────────────────────────
if [[ -z "${FAILOVER_SECRET:-}" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    FAILOVER_SECRET=$(grep "^FAILOVER_SECRET=" "$ENV_FILE" \
      | cut -d= -f2- | tr -d '"' 2>/dev/null || echo "")
  fi
fi

if [[ -z "${FAILOVER_SECRET:-}" ]]; then
  echo "ERROR: FAILOVER_SECRET not set."
  exit 1
fi

# ── Check current state ────────────────────────────────────────────────────────
echo "[1/4] Checking current proxy state..."
CURRENT_STATE=$(curl -sf "https://api.sbbl-hq.icu/ops/proxy-status" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['active'])" \
  2>/dev/null || echo "unknown")

echo "      Current active backend: $CURRENT_STATE"

if [[ "$CURRENT_STATE" == "selfhost" ]]; then
  echo "      Already on self-hosted. Nothing to do."
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  RESTORE: ALREADY ON SELF-HOSTED ✓"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

# ── Safety check: verify self-hosted is actually healthy ──────────────────────
echo "[2/4] Verifying self-hosted is healthy before switching traffic..."

SELFHOST_DIRECT_URL="${SELFHOST_ORIGIN_URL:-}"
if [[ -z "$SELFHOST_DIRECT_URL" && -f "$ENV_FILE" ]]; then
  SELFHOST_DIRECT_URL=$(grep "^SELFHOST_ORIGIN_URL=" "$ENV_FILE" \
    | cut -d= -f2- | tr -d '"' 2>/dev/null || echo "")
fi

if [[ -z "$SELFHOST_DIRECT_URL" ]]; then
  echo "WARNING: SELFHOST_ORIGIN_URL not found. Checking via api.sbbl-hq.icu (may hit cloud)."
  HEALTH_URL="https://api.sbbl-hq.icu${SELFHOST_HEALTH_PATH}"
else
  HEALTH_URL="${SELFHOST_DIRECT_URL}${SELFHOST_HEALTH_PATH}"
fi

HEALTH_STATUS=$(curl -sf "$HEALTH_URL" -o /dev/null -w "%{http_code}" \
  --max-time 5 2>/dev/null || echo "000")

if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo "ERROR: Self-hosted health check returned HTTP $HEALTH_STATUS."
  echo "       Self-hosted is NOT ready. Fix EC2 before restoring traffic."
  echo "       Run: docker compose restart auth  (on EC2)"
  exit 1
fi

echo "      Self-hosted health: HTTP $HEALTH_STATUS ✓"

# ── Issue restore command ─────────────────────────────────────────────────────
echo "[3/4] Issuing restore command to CF Worker..."
RESULT=$(curl -sf -X POST "$API_PROXY" \
  -H "Content-Type: application/json" \
  -H "x-failover-secret: $FAILOVER_SECRET" \
  -d '{"target":"selfhost"}') || {
  echo "ERROR: Failed to reach failover endpoint."
  exit 1
}

SUCCESS=$(echo "$RESULT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null)

if [[ "$SUCCESS" != "True" && "$SUCCESS" != "true" ]]; then
  echo "ERROR: Restore command rejected: $RESULT"
  exit 1
fi

# ── Verify ────────────────────────────────────────────────────────────────────
echo "[4/4] Verifying active backend..."
sleep 2
NEW_STATE=$(curl -sf "https://api.sbbl-hq.icu/ops/proxy-status" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['active'])" \
  2>/dev/null || echo "unknown")

if [[ "$NEW_STATE" == "selfhost" ]]; then
  echo "      Active backend: selfhost ✓"
else
  echo "ERROR: State verification failed. Got: $NEW_STATE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RESTORE TO SELF-HOSTED: COMPLETE ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
