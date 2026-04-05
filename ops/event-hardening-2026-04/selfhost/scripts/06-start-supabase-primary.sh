#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 06-start-supabase-primary.sh
# SSH into the primary EC2, run docker compose up -d, and verify all ~15
# Supabase containers are running.
#
# Usage:
#   ./06-start-supabase-primary.sh
#
# Environment variables (override defaults):
#   SSH_KEY       - path to PEM key (default: ~/.ssh/sbbl-hq-key.pem)
#   PRIMARY_HOST  - primary EC2 public IP (default: 52.21.231.157)
#   COMPOSE_DIR   - docker compose directory on EC2 (default: /home/ubuntu/supabase/docker)
###############################################################################

SSH_KEY="${SSH_KEY:-$HOME/.ssh/sbbl-hq-key.pem}"
PRIMARY_HOST="${PRIMARY_HOST:-52.21.231.157}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/supabase/docker}"
SSH_USER="ubuntu"
SSH_OPTS="-i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

# ── Preflight checks ──────────────────────────────────────────────────────
if [[ ! -f "$SSH_KEY" ]]; then
    echo "Error: SSH key not found at ${SSH_KEY}"
    echo "  Download from CloudShell: Actions → Download file → /tmp/sbbl-hq-key.pem"
    echo "  Then: mv ~/Downloads/sbbl-hq-key.pem ~/.ssh/ && chmod 400 ~/.ssh/sbbl-hq-key.pem"
    exit 1
fi

echo "=== Start Supabase on Primary ==="
echo "Host:        ${PRIMARY_HOST}"
echo "Compose dir: ${COMPOSE_DIR}"
echo "SSH key:     ${SSH_KEY}"
echo ""

# ── Step 1: Check SSH connectivity ────────────────────────────────────────
echo "[1/4] Testing SSH connectivity..."
if ! ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" "echo 'SSH OK'" 2>/dev/null; then
    echo "Error: Cannot SSH into ${PRIMARY_HOST}."
    echo "  - Check that port 22 is open in sg-06b24129c2be7c5ab for your IP"
    echo "  - Run: ./04-fix-ssh-security-group.sh <YOUR_IP>"
    exit 1
fi

# ── Step 2: Check docker pull status ──────────────────────────────────────
echo "[2/4] Checking if docker pull is still running..."
PULL_RUNNING=$(ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" \
    "pgrep -f 'docker pull' > /dev/null 2>&1 && echo 'yes' || echo 'no'")

if [[ "$PULL_RUNNING" == "yes" ]]; then
    echo "  ⚠ docker pull is still running. Waiting for it to finish..."
    ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" bash -s <<'REMOTE'
        while pgrep -f 'docker pull' > /dev/null 2>&1; do
            echo "  ... still pulling ($(date +%H:%M:%S))"
            sleep 15
        done
        echo "  ✓ docker pull finished"
REMOTE
else
    echo "  ✓ No active docker pull detected"
fi

# ── Step 3: Start Supabase stack ──────────────────────────────────────────
echo "[3/4] Running docker compose up -d..."
ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" bash -s <<REMOTE
    cd "${COMPOSE_DIR}" || { echo "Error: ${COMPOSE_DIR} not found"; exit 1; }
    docker compose up -d
REMOTE

echo "  ✓ docker compose up -d completed"
echo ""

# ── Step 4: Verify containers ─────────────────────────────────────────────
echo "[4/4] Verifying containers..."
sleep 5  # Give containers a moment to start

CONTAINER_LIST=$(ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" \
    "docker ps --format '{{.Names}}\t{{.Status}}' | grep -i supabase | sort")

CONTAINER_COUNT=$(echo "$CONTAINER_LIST" | grep -c "Up" || true)

echo ""
echo "=== Running Supabase Containers (${CONTAINER_COUNT}) ==="
echo "$CONTAINER_LIST"
echo ""

# Expected core services
EXPECTED_SERVICES=(
    "studio"
    "kong"
    "auth"
    "rest"
    "realtime"
    "storage"
    "db"
    "meta"
    "functions"
    "analytics"
    "imgproxy"
)

echo "=== Service Check ==="
MISSING=0
for svc in "${EXPECTED_SERVICES[@]}"; do
    if echo "$CONTAINER_LIST" | grep -qi "$svc"; then
        echo "  ✓ ${svc}"
    else
        echo "  ✗ ${svc} — NOT FOUND"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
if [[ $MISSING -gt 0 ]]; then
    echo "⚠ ${MISSING} expected service(s) not running. Check logs:"
    echo "  ssh $SSH_OPTS ${SSH_USER}@${PRIMARY_HOST} 'cd ${COMPOSE_DIR} && docker compose logs --tail=50'"
    exit 1
else
    echo "✓ All core Supabase services are running."
    echo ""
    echo "Next steps:"
    echo "  - Open API port:    ./07-open-api-studio-ports.sh"
    echo "  - Validate deploy:  ./05-post-deploy-validate.sh"
fi
