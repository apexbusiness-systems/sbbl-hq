#!/usr/bin/env bash
# =============================================================================
# SBBL-HQ — JWT Secret Sync: Self-Hosted → Supabase Cloud
# Run ON EC2 before event start.
# Requires: .env populated with JWT_SECRET + SUPABASE_MGMT_ACCESS_TOKEN
# =============================================================================
set -euo pipefail

SELFHOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../selfhost" && pwd)"
ENV_FILE="$SELFHOST_DIR/.env"
PROJECT_REF="ezanilxygnpucwkwpsoc"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ JWT Secret Sync"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Load secrets from .env ─────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE"
  exit 1
fi

JWT_SECRET=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')
MGMT_TOKEN=$(grep "^SUPABASE_MGMT_ACCESS_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')

if [[ -z "$JWT_SECRET" ]]; then
  echo "ERROR: JWT_SECRET not found in .env"
  exit 1
fi

if [[ -z "$MGMT_TOKEN" ]]; then
  echo "ERROR: SUPABASE_MGMT_ACCESS_TOKEN not found in .env"
  echo "       Get one at: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

echo "[1/4] JWT_SECRET loaded (length: ${#JWT_SECRET})"

# ── Check current cloud JWT secret ────────────────────────────────────────────
echo "[2/4] Checking current Supabase Cloud JWT secret..."
CURRENT_CONFIG=$(curl -sf \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth") || {
  echo "ERROR: Failed to fetch cloud auth config. Check MGMT_TOKEN and project ref."
  exit 1
}

CURRENT_JWT=$(echo "$CURRENT_CONFIG" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('jwt_secret','NOT_SET'))" 2>/dev/null || echo "PARSE_ERROR")

if [[ "$CURRENT_JWT" == "$JWT_SECRET" ]]; then
  echo "      Cloud JWT secret already matches self-hosted. Nothing to do."
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  JWT SYNC: ALREADY IN SYNC ✓"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

echo "      Cloud JWT differs from self-hosted. Syncing..."

# ── Push JWT_SECRET to cloud ───────────────────────────────────────────────────
echo "[3/4] Pushing JWT_SECRET to Supabase Cloud..."
curl -sf -X PATCH \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jwt_secret\": \"$JWT_SECRET\"}" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" >/dev/null || {
  echo "ERROR: Failed to PATCH cloud JWT secret."
  exit 1
}

echo "      Cloud JWT updated."

# ── Verify ────────────────────────────────────────────────────────────────────
echo "[4/4] Verifying sync..."
sleep 3
VERIFY_CONFIG=$(curl -sf \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth")

VERIFY_JWT=$(echo "$VERIFY_CONFIG" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('jwt_secret','NOT_SET'))" 2>/dev/null)

if [[ "$VERIFY_JWT" == "$JWT_SECRET" ]]; then
  echo "      Verified: Cloud JWT matches self-hosted ✓"
else
  echo "ERROR: Verification failed. Cloud JWT still differs. Retry or check manually."
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  JWT SYNC: COMPLETE ✓"
echo "  Both backends now accept each other's tokens."
echo "  Users will NOT be logged out on backend switch."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
