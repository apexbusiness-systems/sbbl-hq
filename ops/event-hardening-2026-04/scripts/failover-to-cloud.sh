#!/usr/bin/env bash
# =============================================================================
# SBBL-HQ — Failover: Self-Hosted → Supabase Cloud
# Run from ANYWHERE with internet access (not required to be on EC2).
# Usage: FAILOVER_SECRET=xxx bash failover-to-cloud.sh
# =============================================================================
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELFHOST_DIR="$SCRIPTS_DIR/../selfhost"
ENV_FILE="$SELFHOST_DIR/.env"

API_PROXY="https://api.sbbl-hq.icu/ops/failover"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ → Failing Over to Cloud"
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
  echo "ERROR: FAILOVER_SECRET not set. Export it or add to .env."
  exit 1
fi

# ── Check current state ────────────────────────────────────────────────────────
echo "[1/3] Checking current proxy state..."
CURRENT_STATE=$(curl -sf "https://api.sbbl-hq.icu/ops/proxy-status" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['active'])" \
  2>/dev/null || echo "unknown")

echo "      Current active backend: $CURRENT_STATE"

if [[ "$CURRENT_STATE" == "cloud" ]]; then
  echo "      Already on cloud. Nothing to do."
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  FAILOVER: ALREADY ON CLOUD ✓"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

# ── Issue failover command ────────────────────────────────────────────────────
echo "[2/3] Issuing failover command to CF Worker..."
RESULT=$(curl -sf -X POST "$API_PROXY" \
  -H "Content-Type: application/json" \
  -H "x-failover-secret: $FAILOVER_SECRET" \
  -d '{"target":"cloud"}') || {
  echo "ERROR: Failed to reach failover endpoint. Is api.sbbl-hq.icu up?"
  exit 1
}

SUCCESS=$(echo "$RESULT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null)

if [[ "$SUCCESS" != "True" && "$SUCCESS" != "true" ]]; then
  echo "ERROR: Failover command rejected: $RESULT"
  exit 1
fi

echo "      Failover issued."

# ── Verify new state ──────────────────────────────────────────────────────────
echo "[3/3] Verifying new state..."
sleep 2
NEW_STATE=$(curl -sf "https://api.sbbl-hq.icu/ops/proxy-status" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['active'])" \
  2>/dev/null || echo "unknown")

if [[ "$NEW_STATE" == "cloud" ]]; then
  echo "      Active backend: cloud ✓"
else
  echo "ERROR: State verification failed. Got: $NEW_STATE"
  exit 1
fi

# ── Test cloud endpoint ───────────────────────────────────────────────────────
HEALTH=$(curl -s "https://api.sbbl-hq.icu/auth/v1/health" \
  -o /dev/null -w "%{http_code}" 2>/dev/null || true)
HEALTH="${HEALTH:-000}"
echo "      Cloud auth health: HTTP $HEALTH $([ "$HEALTH" = "200" ] && echo "✓" || echo "✗")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FAILOVER TO CLOUD: COMPLETE ✓"
echo "  Users will NOT be logged out (JWT compatible)."
echo "  To restore self-hosted: bash failover-to-selfhost.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
