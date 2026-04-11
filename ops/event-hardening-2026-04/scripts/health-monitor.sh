#!/usr/bin/env bash
# =============================================================================
# SBBL-HQ — External Health Monitor + Auto-Failover Watchdog
# Run from: any machine with internet (laptop, phone hotspot, secondary VPS)
# Usage: FAILOVER_SECRET=xxx bash health-monitor.sh
# Stop:  Ctrl+C
# =============================================================================
set -euo pipefail

POLL_INTERVAL=30       # seconds between checks
FAILURE_THRESHOLD=3    # consecutive failures before auto-failover
TIMEOUT=5              # curl timeout per check

STATUS_URL="https://api.sbbl-hq.icu/ops/proxy-status"
SELFHOST_ORIGIN="${SELFHOST_ORIGIN_URL:-}"  # direct EC2 URL, bypasses CF
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${FAILOVER_SECRET:-}" ]]; then
  echo "ERROR: FAILOVER_SECRET must be set as env var."
  echo "       Usage: FAILOVER_SECRET=xxx bash health-monitor.sh"
  exit 1
fi

consecutive_failures=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ Health Monitor"
echo "  Poll interval: ${POLL_INTERVAL}s | Threshold: ${FAILURE_THRESHOLD} failures"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_health() {
  local url="$1"
  local code
  code=$(curl -s "$url" -o /dev/null -w "%{http_code}" \
    --max-time "$TIMEOUT" 2>/dev/null || true)
  echo "${code:-000}"
}

while true; do
  NOW=$(date '+%H:%M:%S')

  # Get current proxy state
  PROXY_STATE=$(curl -sf "$STATUS_URL" --max-time "$TIMEOUT" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('active','?'),d.get('failures',0))" \
    2>/dev/null || echo "unreachable 0")

  ACTIVE=$(echo "$PROXY_STATE" | awk '{print $1}')
  FAILURES=$(echo "$PROXY_STATE" | awk '{print $2}')

  # Check self-hosted directly (bypasses CF if SELFHOST_ORIGIN_URL is set)
  if [[ -n "$SELFHOST_ORIGIN" ]]; then
    SH_CODE=$(check_health "${SELFHOST_ORIGIN}/auth/v1/health")
  else
    SH_CODE=$(check_health "https://api.sbbl-hq.icu/auth/v1/health")
  fi

  if [[ "$SH_CODE" == "200" ]]; then
    consecutive_failures=0
    echo "[$NOW] ✓ self-hosted=UP(HTTP $SH_CODE) | proxy_active=$ACTIVE | proxy_failures=$FAILURES"
  else
    consecutive_failures=$((consecutive_failures + 1))
    echo "[$NOW] ✗ self-hosted=DOWN(HTTP $SH_CODE) | consecutive=$consecutive_failures/$FAILURE_THRESHOLD | proxy_active=$ACTIVE"

    if [[ "$consecutive_failures" -ge "$FAILURE_THRESHOLD" && "$ACTIVE" == "selfhost" ]]; then
      echo ""
      echo "[$NOW] !!! AUTO-FAILOVER TRIGGERED after $consecutive_failures failures"
      echo "[$NOW] !!! Switching to cloud..."
      if FAILOVER_SECRET="$FAILOVER_SECRET" bash "$SCRIPTS_DIR/failover-to-cloud.sh"; then
        echo "[$NOW] ✓ Auto-failover to cloud: SUCCESS"
        consecutive_failures=0
      else
        echo "[$NOW] ✗ Auto-failover FAILED — manual intervention required"
      fi
      echo ""
    fi
  fi

  sleep "$POLL_INTERVAL"
done
