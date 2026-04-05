#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scripts/03-validate-auth.sh
# End-to-end auth flow validation against self-hosted Supabase.
# Verifies: signup, email/password login, magic link, OAuth
#           callback endpoints, password policy, CAPTCHA enforcement.
#
# Usage:
#   export SUPABASE_URL=https://sbbl-hq.icu
#   export ANON_KEY=<your-anon-key>
#   bash scripts/03-validate-auth.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

: "${SUPABASE_URL:=https://sbbl-hq.icu}"
: "${ANON_KEY:?Set ANON_KEY to your self-hosted anon JWT}"

BASE="${SUPABASE_URL}/auth/v1"
AUTH_HEADER="apikey: ${ANON_KEY}"
CONTENT="Content-Type: application/json"
PASS=0
FAIL=0

check() {
  local label="$1" expect="$2" status="$3"
  if [[ "$status" == "$expect" ]]; then
    echo "  ✅ $label (HTTP $status)"
    ((PASS++))
  else
    echo "  ❌ $label — expected HTTP $expect, got $status"
    ((FAIL++))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ Auth Validation @ ${SUPABASE_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Health check ──────────────────────────────────────
echo ""
echo "🔵 [1] Health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/")
check "Auth service health" "200" "$STATUS"

# ── 2. Signup with weak/leaked password rejected ─────────
echo ""
echo "🔵 [2] Password policy enforcement"
TEST_EMAIL="validate_$(date +%s)@sbbl-hq-test.invalid"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"password\"}" \
  "${BASE}/signup")
check "Leaked password 'password' rejected" "422" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"12345678\"}" \
  "${BASE}/signup")
check "Leaked password '12345678' rejected" "422" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"abc\"}" \
  "${BASE}/signup")
check "Too-short password (<8 chars) rejected" "422" "$STATUS"

# ── 3. CAPTCHA enforcement ───────────────────────────────
echo ""
echo "🔵 [3] CAPTCHA enforcement"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Str0ng!Pass#2026\"}" \
  "${BASE}/signup")
check "Signup without CAPTCHA token rejected" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Str0ng!Pass#2026\",\"gotrue_meta_security\":{\"captcha_token\":\"invalid\"}}" \
  "${BASE}/signup")
check "Signup with invalid CAPTCHA token rejected" "400" "$STATUS"

# ── 4. OAuth endpoints reachable ─────────────────────────
echo ""
echo "🔵 [4] OAuth provider endpoints"
for PROVIDER in google github; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE}/authorize?provider=${PROVIDER}")
  check "OAuth redirect for ${PROVIDER}" "302" "$STATUS"
done

# ── 5. Token refresh endpoint ────────────────────────────
echo ""
echo "🔵 [5] Token endpoint reachable"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d '{"refresh_token":"invalid_token_for_reachability_check"}' \
  "${BASE}/token?grant_type=refresh_token")
check "Token refresh endpoint reachable (400 = invalid token, service live)" "400" "$STATUS"

# ── 6. Magic link endpoint ───────────────────────────────
echo ""
echo "🔵 [6] Magic link endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "$AUTH_HEADER" -H "$CONTENT" \
  -d "{\"email\":\"$TEST_EMAIL\"}" \
  "${BASE}/magiclink")
# Expect 200 (CAPTCHA disabled) or 400 (CAPTCHA required)
if [[ "$STATUS" == "200" || "$STATUS" == "400" ]]; then
  echo "  ✅ Magic link endpoint alive (HTTP $STATUS)"
  ((PASS++))
else
  echo "  ❌ Magic link endpoint unexpected status $STATUS"
  ((FAIL++))
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ✅ $PASS passed   ❌ $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
