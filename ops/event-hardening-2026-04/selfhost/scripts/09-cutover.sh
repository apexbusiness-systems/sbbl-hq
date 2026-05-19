#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 09-cutover.sh
# Supabase Cloud → Self-Hosted cutover.
# Updates Cloudflare Worker secrets, Pages env vars, and DNS A record to
# point sbbl-hq.icu at the self-hosted EC2 instance.
#
# Usage:
#   ./09-cutover.sh [--dry-run]
#
# Prerequisites:
#   - wrangler CLI installed and authenticated (wrangler whoami)
#   - CF_API_TOKEN env var set (Zone:Edit + Workers:Edit permissions)
#   - CF_ZONE_ID env var set  (from Cloudflare dashboard → Overview)
#   - CF_PAGES_PROJECT set    (default: sbbl-hq)
#   - .env file in COMPOSE_DIR on primary EC2 with ANON_KEY / SERVICE_ROLE_KEY
#   - SSH key available at ~/.ssh/sbbl-hq-key.pem
###############################################################################

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[DRY RUN] No changes will be made."
fi

# ── Configuration ────────────────────────────────────────────────────────────
PRIMARY_HOST="${PRIMARY_HOST:-52.21.231.157}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/sbbl-hq-key.pem}"
SSH_USER="ubuntu"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/supabase/docker}"
SSH_OPTS="-i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

CF_ZONE_ID="${CF_ZONE_ID:-}"        # Required
CF_API_TOKEN="${CF_API_TOKEN:-}"    # Required
CF_PAGES_PROJECT="${CF_PAGES_PROJECT:-sbbl-hq}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-}" # Required for Pages API
DOMAIN="sbbl-hq.icu"
API_DOMAIN="api.sbbl-hq.icu"
# SUPABASE_URL must point at the Supabase API subdomain, not the app domain.
# The Worker's JWKS client and admin client both use this URL; pointing it at
# the app domain (sbbl-hq.icu) means Kong is never reached and JWT verification
# fails for every request issued by the self-hosted GoTrue (RC-1 / RC-2 fix).
SELF_HOSTED_URL="https://${API_DOMAIN}"
WORKER_NAME="sbbl-hq-worker"

# ── Helpers ──────────────────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }
run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

# ── Preflight ────────────────────────────────────────────────────────────────
echo "=== SBBL-HQ Cutover: Cloud → Self-Hosted ==="
echo "Target: ${SELF_HOSTED_URL}"
echo ""

[[ ! -f "$SSH_KEY" ]] && die "SSH key not found: ${SSH_KEY}"
[[ -z "$CF_ZONE_ID" ]]    && die "CF_ZONE_ID is required"
[[ -z "$CF_API_TOKEN" ]]  && die "CF_API_TOKEN is required"
[[ -z "$CF_ACCOUNT_ID" ]] && die "CF_ACCOUNT_ID is required"

command -v wrangler &>/dev/null || die "wrangler not found. Install: npm i -g wrangler"
command -v curl     &>/dev/null || die "curl not found"

# ── Step 1: Fetch new keys from self-hosted .env ──────────────────────────────
echo "[1/6] Fetching ANON_KEY and SERVICE_ROLE_KEY from primary EC2..."
ANON_KEY=$(ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" \
  "grep -E '^ANON_KEY=' ${COMPOSE_DIR}/.env | cut -d= -f2-")
SERVICE_KEY=$(ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" \
  "grep -E '^SERVICE_ROLE_KEY=' ${COMPOSE_DIR}/.env | cut -d= -f2-")

[[ -z "$ANON_KEY" ]]    && die "ANON_KEY is empty in .env — run 01-generate-keys.sh first"
[[ -z "$SERVICE_KEY" ]] && die "SERVICE_ROLE_KEY is empty in .env"
echo "  ✓ Keys fetched (${#ANON_KEY} chars ANON, ${#SERVICE_KEY} chars SERVICE)"

# ── Step 2: Update Cloudflare Worker secrets ─────────────────────────────────
echo "[2/6] Updating Cloudflare Worker secrets for ${WORKER_NAME}..."
run "echo '${SELF_HOSTED_URL}' | wrangler secret put SUPABASE_URL           --name ${WORKER_NAME}"
run "echo '${ANON_KEY}'        | wrangler secret put SUPABASE_ANON_KEY       --name ${WORKER_NAME}"
# The worker Env type declares SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_SERVICE_KEY).
# Pushing to the wrong name leaves SUPABASE_SERVICE_ROLE_KEY unset → admin client
# cannot be created → every authenticated worker route returns 500 (RC-1 fix).
run "echo '${SERVICE_KEY}'     | wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name ${WORKER_NAME}"
# SUPABASE_PUBLISHABLE_KEY is the anon key returned by /api/public-config to
# the browser Supabase client.  Must match the self-hosted anon key so the
# frontend calls the correct project after cutover.
run "echo '${ANON_KEY}'        | wrangler secret put SUPABASE_PUBLISHABLE_KEY  --name ${WORKER_NAME}"
echo "  ✓ Worker secrets updated"

# ── Step 3: Update Cloudflare Pages environment variables ────────────────────
echo "[3/6] Updating Cloudflare Pages env vars for project '${CF_PAGES_PROJECT}'..."
PAGES_PAYLOAD=$(cat <<EOF
{
  "deployment_configs": {
    "production": {
      "env_vars": {
        "SUPABASE_URL": { "value": "${SELF_HOSTED_URL}" },
        "NEXT_PUBLIC_SUPABASE_URL": { "value": "${SELF_HOSTED_URL}" },
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": { "value": "${ANON_KEY}" }
      }
    }
  }
}
EOF
)
if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] PATCH https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT}"
else
  CF_PAGES_RESP=$(curl -s -X PATCH \
    "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${PAGES_PAYLOAD}")
  echo "$CF_PAGES_RESP" | grep -q '"success":true' || die "Pages update failed: $CF_PAGES_RESP"
  echo "  ✓ Pages env vars updated"
fi

# ── Step 4: Update Cloudflare DNS A records ───────────────────────────────────
# Two A records are required:
#   sbbl-hq.icu     → EC2 primary (app / Studio)
#   api.sbbl-hq.icu → EC2 primary (Supabase API / Kong)
# Without the api.* record, Caddy has no resolvable vhost for api.sbbl-hq.icu
# and Kong is never reached (RC-0 / RC-8 fix).

upsert_dns_a() {
  local name="$1" ip="$2"
  echo "[4/6] Updating Cloudflare DNS A record ${name} → ${ip}..."
  local record_id
  record_id=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${name}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" | \
    python3 -c "import sys,json; records=json.load(sys.stdin)['result']; print(records[0]['id'] if records else '')" 2>/dev/null || true)

  local method url
  if [[ -z "$record_id" ]]; then
    echo "  No existing A record for ${name} — creating new one"
    method="POST"
    url="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records"
  else
    echo "  Existing record ID for ${name}: ${record_id}"
    method="PUT"
    url="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${record_id}"
  fi

  local payload="{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${ip}\",\"ttl\":60,\"proxied\":true}"
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] ${method} ${url} — ${name} → ${ip} (proxied)"
  else
    local resp
    resp=$(curl -s -X "${method}" "${url}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "${payload}")
    echo "$resp" | grep -q '"success":true' || die "DNS update failed for ${name}: $resp"
    echo "  ✓ DNS updated — ${name} → ${ip} (proxied, TTL 60s)"
  fi
}

upsert_dns_a "${DOMAIN}"     "${PRIMARY_HOST}"
upsert_dns_a "${API_DOMAIN}" "${PRIMARY_HOST}"

# ── Step 5: Smoke test self-hosted endpoints ──────────────────────────────────
echo "[5/6] Smoke testing ${SELF_HOSTED_URL}..."
if [[ "$DRY_RUN" == false ]]; then
  echo -n "  Waiting for DNS propagation (30s)..."
  sleep 30
  echo " done."

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 15 "${SELF_HOSTED_URL}/auth/v1/" || echo "000")
  if [[ "$HTTP_STATUS" == "401" ]]; then
    echo "  ✓ Auth endpoint: HTTP ${HTTP_STATUS} (expected)"
  else
    echo "  ⚠ Auth endpoint returned HTTP ${HTTP_STATUS} (expected 401). Check Caddy + GoTrue."
  fi

  REST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 15 \
    -H "apikey: ${ANON_KEY}" \
    "${SELF_HOSTED_URL}/rest/v1/" || echo "000")
  if [[ "$REST_STATUS" == "200" ]] || [[ "$REST_STATUS" == "404" ]]; then
    echo "  ✓ REST endpoint: HTTP ${REST_STATUS} (reachable)"
  else
    echo "  ⚠ REST endpoint returned HTTP ${REST_STATUS}. Investigate."
  fi
fi

# ── Step 6: Print post-cutover checklist ─────────────────────────────────────
echo ""
echo "[6/6] Post-Cutover Checklist:"
echo "  [ ] Verify https://api.sbbl-hq.icu/auth/v1/health returns 200"
echo "  [ ] Verify production login / signup at https://sbbl-hq.icu"
echo "  [ ] Verify Google OAuth callback: ${SELF_HOSTED_URL}/auth/v1/callback"
echo "  [ ] Verify GitHub OAuth callback: ${SELF_HOSTED_URL}/auth/v1/callback"
echo "  [ ] Verify magic link emails arrive (check Resend dashboard)"
echo "  [ ] Verify Stripe webhooks reach self-hosted (check Stripe dashboard)"
echo "  [ ] Update OAuth App callback URLs in Google Console + GitHub"
echo "  [ ] Apply pending migrations via: supabase db push (or manual psql)"
echo "  [ ] Reload PostgREST schema: NOTIFY pgrst, 'reload schema';"
echo "  [ ] Keep Supabase Cloud alive in read-only mode for 72h rollback window"
echo "  [ ] Run scripts/05-post-deploy-validate.sh for full health check"
echo "  [ ] Run k6 load test: k6 run tests/load-auth.js"
echo ""
echo "=== Cutover complete ($(date -u '+%Y-%m-%dT%H:%M:%SZ')) ==="
