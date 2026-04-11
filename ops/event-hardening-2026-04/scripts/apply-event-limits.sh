#!/usr/bin/env bash
# =============================================================================
# SBBL-HQ — Full Event Hardening: Rate Limits + PgBouncer + JWT + Pre-flight
# Run ON EC2 as: bash apply-event-limits.sh
# =============================================================================
set -euo pipefail

SELFHOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../selfhost" && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SELFHOST_DIR/.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ Full Event Hardening"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo "[PRE] Verifying environment..."
[[ -f "$ENV_FILE" ]] || { echo "ERROR: .env not found at $ENV_FILE"; exit 1; }
command -v docker >/dev/null || { echo "ERROR: docker not found"; exit 1; }
command -v curl >/dev/null   || { echo "ERROR: curl not found"; exit 1; }

BACKUP="$ENV_FILE.backup.$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "      Backup: $BACKUP"

# ── Patch .env ────────────────────────────────────────────────────────────────
patch_env_var() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    if grep -q "^${key}=${value}$" "$ENV_FILE"; then
      echo "      SKIP (unchanged): ${key}=${value}"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
      echo "      UPDATED: ${key}=${value}"
    fi
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    echo "      ADDED:   ${key}=${value}"
  fi
}

echo "[1/6] Patching GoTrue rate limits..."
patch_env_var "GOTRUE_RATE_LIMIT_EMAIL_SENT"    "10000"
patch_env_var "GOTRUE_RATE_LIMIT_TOKEN_REFRESH" "10000"
patch_env_var "GOTRUE_RATE_LIMIT_VERIFY"        "10000"
patch_env_var "GOTRUE_RATE_LIMIT_ANONYMOUS"     "0"

echo "[2/6] Restarting GoTrue..."
cd "$SELFHOST_DIR"
docker compose restart auth
sleep 5

GOTRUE_HEALTH=$(curl -sf https://api.sbbl-hq.icu/auth/v1/health \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('status')=='ok' else 'FAIL')" \
  2>/dev/null || echo "FAIL")

if [[ "$GOTRUE_HEALTH" != "OK" ]]; then
  echo "ERROR: GoTrue unhealthy after restart. Rolling back .env..."
  cp "$BACKUP" "$ENV_FILE"
  docker compose restart auth
  exit 1
fi
echo "      GoTrue: $GOTRUE_HEALTH ✓"

echo "[3/6] Restarting PgBouncer with new pool size..."
docker compose -f docker-compose.yml -f docker-compose.pgbouncer.yml \
  up -d --no-deps pgbouncer
sleep 5

POOL=$(docker exec supabase-pgbouncer psql -p 6432 -U pgbouncer pgbouncer \
  -c "SHOW CONFIG;" 2>/dev/null \
  | grep "default_pool_size" | awk '{print $3}' || echo "UNKNOWN")
echo "      PgBouncer pool size: $POOL $([ "$POOL" = "100" ] && echo "✓" || echo "(expected 100)")"

echo "[4/6] Running JWT sync to cloud..."
bash "$SCRIPTS_DIR/jwt-sync.sh" || echo "WARNING: JWT sync failed. Run manually before event."

echo "[5/6] Verifying failover scripts are executable..."
for script in failover-to-cloud.sh failover-to-selfhost.sh health-monitor.sh jwt-sync.sh; do
  SCRIPT_PATH="$SCRIPTS_DIR/$script"
  if [[ -x "$SCRIPT_PATH" ]]; then
    echo "      $script ✓"
  else
    chmod +x "$SCRIPT_PATH"
    echo "      $script chmod'd ✓"
  fi
done

echo "[6/6] Final health sweep..."
for endpoint in \
  "GoTrue|https://api.sbbl-hq.icu/auth/v1/health|200" \
  "PostgREST|https://api.sbbl-hq.icu/rest/v1/|200" \
  "Worker|https://sbbl-hq.icu/ops/health|200" \
  "ProxyStatus|https://api.sbbl-hq.icu/ops/proxy-status|200"; do
  label=$(echo "$endpoint" | cut -d'|' -f1)
  url=$(echo "$endpoint" | cut -d'|' -f2)
  expected=$(echo "$endpoint" | cut -d'|' -f3)
  actual=$(curl -s "$url" -o /dev/null -w "%{http_code}" --max-time 5 2>/dev/null || true)
  actual="${actual:-000}"
  status=$([ "$actual" = "$expected" ] && echo "✓" || echo "✗ (got $actual)")
  echo "      $label: HTTP $actual $status"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EVENT HARDENING: COMPLETE"
echo "  Rollback: cp $BACKUP $ENV_FILE && docker compose restart auth"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
