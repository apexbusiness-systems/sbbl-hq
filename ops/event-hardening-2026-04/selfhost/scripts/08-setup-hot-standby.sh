#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 08-setup-hot-standby.sh
# End-to-end setup of a PostgreSQL streaming replication hot standby on the
# replica EC2 instance, running the same Supabase stack as the primary.
#
# This script:
#   1. Installs Docker + Docker Compose on the replica (if missing)
#   2. Copies the Supabase docker-compose config to the replica
#   3. Creates the replication user on the primary
#   4. Creates a replication slot on the primary
#   5. Updates pg_hba.conf on the primary to allow the replica
#   6. Runs pg_basebackup on the replica from the primary
#   7. Configures the replica for streaming replication
#   8. Starts the Supabase stack on the replica
#   9. Verifies replication is active
#
# Usage:
#   ./08-setup-hot-standby.sh <REPLICATION_PASSWORD>
#
# Environment variables (override defaults):
#   SSH_KEY         - path to PEM key (default: ~/.ssh/sbbl-hq-key.pem)
#   PRIMARY_HOST    - primary EC2 public IP (default: 52.21.231.157)
#   PRIMARY_PRIVATE - primary EC2 private IP (default: 172.31.17.195)
#   REPLICA_HOST    - replica EC2 public IP (default: 3.83.9.123)
#   COMPOSE_DIR     - docker compose dir on both hosts (default: /home/ubuntu/supabase/docker)
#
# Requires: SSH access to both primary and replica EC2 instances
###############################################################################

# ── Configuration ─────────────────────────────────────────────────────────
SSH_KEY="${SSH_KEY:-$HOME/.ssh/sbbl-hq-key.pem}"
PRIMARY_HOST="${PRIMARY_HOST:-52.21.231.157}"
PRIMARY_PRIVATE="${PRIMARY_PRIVATE:-172.31.17.195}"
REPLICA_HOST="${REPLICA_HOST:-3.83.9.123}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/supabase/docker}"
SSH_USER="ubuntu"
SSH_OPTS="-i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
REPL_USER="replicator"
SLOT_NAME="replica_1"

# ── Validate input ────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <REPLICATION_PASSWORD>"
    echo ""
    echo "  Generate a strong password:"
    echo "    openssl rand -base64 24"
    exit 1
fi

REPL_PASS="$1"

if [[ ${#REPL_PASS} -lt 12 ]]; then
    echo "Error: Replication password should be at least 12 characters."
    exit 1
fi

# ── Preflight ─────────────────────────────────────────────────────────────
if [[ ! -f "$SSH_KEY" ]]; then
    echo "Error: SSH key not found at ${SSH_KEY}"
    exit 1
fi

echo "============================================================"
echo " Hot Standby Replica Setup"
echo "============================================================"
echo "Primary:     ${PRIMARY_HOST} (private: ${PRIMARY_PRIVATE})"
echo "Replica:     ${REPLICA_HOST}"
echo "Repl user:   ${REPL_USER}"
echo "Repl slot:   ${SLOT_NAME}"
echo "Compose dir: ${COMPOSE_DIR}"
echo ""

# ── Helper: run command on a remote host ──────────────────────────────────
run_primary() { ssh $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}" "$@"; }
run_replica() { ssh $SSH_OPTS "${SSH_USER}@${REPLICA_HOST}" "$@"; }

# ── Step 1: Verify SSH to both hosts ─────────────────────────────────────
echo "[1/9] Verifying SSH connectivity..."
run_primary "echo '  ✓ Primary SSH OK'" 2>/dev/null
run_replica "echo '  ✓ Replica SSH OK'" 2>/dev/null
echo ""

# ── Step 2: Install Docker on replica (if needed) ────────────────────────
echo "[2/9] Ensuring Docker is installed on replica..."
run_replica bash -s <<'REMOTE'
    if command -v docker &>/dev/null && docker compose version &>/dev/null; then
        echo "  ✓ Docker and Docker Compose already installed"
    else
        echo "  Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker "$USER"
        echo "  ✓ Docker installed"
    fi
    docker --version
    docker compose version
REMOTE
echo ""

# ── Step 3: Clone Supabase docker setup to replica ──────────────────────
echo "[3/9] Setting up Supabase docker config on replica..."
run_replica bash -s <<REMOTE
    if [[ -d "${COMPOSE_DIR}" ]]; then
        echo "  ✓ Compose directory already exists at ${COMPOSE_DIR}"
    else
        echo "  Cloning supabase/supabase docker setup..."
        git clone --depth 1 https://github.com/supabase/supabase.git /tmp/supabase-clone
        mkdir -p "$(dirname "${COMPOSE_DIR}")"
        cp -r /tmp/supabase-clone/docker "${COMPOSE_DIR}"
        rm -rf /tmp/supabase-clone
        echo "  ✓ Supabase docker config copied to ${COMPOSE_DIR}"
    fi
REMOTE
echo ""

# ── Step 4: Copy .env from primary to replica ────────────────────────────
echo "[4/9] Copying .env from primary to replica..."
scp $SSH_OPTS "${SSH_USER}@${PRIMARY_HOST}:${COMPOSE_DIR}/.env" /tmp/sbbl-hq-primary.env 2>/dev/null
scp $SSH_OPTS /tmp/sbbl-hq-primary.env "${SSH_USER}@${REPLICA_HOST}:${COMPOSE_DIR}/.env" 2>/dev/null
rm -f /tmp/sbbl-hq-primary.env
echo "  ✓ .env copied"
echo ""

# ── Step 5: Create replication user on primary ───────────────────────────
echo "[5/9] Creating replication user on primary..."
run_primary bash -s <<REMOTE
    docker exec supabase-db psql -U supabase_admin -d postgres -c \
        "DO \\\$\\\$
         BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${REPL_USER}') THEN
             CREATE ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASS}';
             RAISE NOTICE 'Created replication user ${REPL_USER}';
           ELSE
             ALTER ROLE ${REPL_USER} WITH PASSWORD '${REPL_PASS}';
             RAISE NOTICE 'Updated password for existing user ${REPL_USER}';
           END IF;
         END
         \\\$\\\$;"
    echo "  ✓ Replication user ready"
REMOTE
echo ""

# ── Step 6: Create replication slot on primary ───────────────────────────
echo "[6/9] Creating replication slot on primary..."
run_primary bash -s <<REMOTE
    SLOT_EXISTS=\$(docker exec supabase-db psql -U supabase_admin -d postgres -t -c \
        "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '${SLOT_NAME}';" | tr -d ' ')
    if [[ "\$SLOT_EXISTS" == "0" ]]; then
        docker exec supabase-db psql -U supabase_admin -d postgres -c \
            "SELECT pg_create_physical_replication_slot('${SLOT_NAME}');"
        echo "  ✓ Replication slot '${SLOT_NAME}' created"
    else
        echo "  ✓ Replication slot '${SLOT_NAME}' already exists"
    fi
REMOTE
echo ""

# ── Step 7: Update pg_hba.conf on primary ────────────────────────────────
echo "[7/9] Updating pg_hba.conf on primary to allow replica..."
run_primary bash -s <<REMOTE
    # Get the replica's private IP (for VPC-internal replication)
    # Add both the private subnet and the specific replica
    HBA_ENTRY="host    replication     ${REPL_USER}    10.0.0.0/8    scram-sha-256"
    HBA_ENTRY2="host    replication     ${REPL_USER}    172.16.0.0/12    scram-sha-256"

    # Check if already added
    EXISTING=\$(docker exec supabase-db cat /var/lib/postgresql/data/pg_hba.conf | grep "${REPL_USER}" || true)
    if [[ -n "\$EXISTING" ]]; then
        echo "  ✓ pg_hba.conf already has replication entry for ${REPL_USER}"
    else
        docker exec supabase-db bash -c "echo '${HBA_ENTRY}' >> /var/lib/postgresql/data/pg_hba.conf"
        docker exec supabase-db bash -c "echo '${HBA_ENTRY2}' >> /var/lib/postgresql/data/pg_hba.conf"
        docker exec supabase-db psql -U supabase_admin -c "SELECT pg_reload_conf();"
        echo "  ✓ pg_hba.conf updated and config reloaded"
    fi
REMOTE
echo ""

# ── Step 8: Stop replica DB, run pg_basebackup ──────────────────────────
echo "[8/9] Running pg_basebackup on replica from primary..."
echo "  This may take several minutes depending on database size..."
run_replica bash -s <<REMOTE
    # Stop existing DB container if running
    cd "${COMPOSE_DIR}"
    docker compose stop supabase-db 2>/dev/null || true

    # Clear existing data directory (backup will replace it)
    DB_DATA="${COMPOSE_DIR}/volumes/db/data"
    if [[ -d "\${DB_DATA}" ]]; then
        echo "  Clearing existing DB data directory..."
        sudo rm -rf "\${DB_DATA}"
    fi
    mkdir -p "\${DB_DATA}"

    # Run pg_basebackup using a temporary postgres container
    echo "  Starting pg_basebackup..."
    docker run --rm \
        -v "\${DB_DATA}:/var/lib/postgresql/data" \
        -e PGPASSWORD="${REPL_PASS}" \
        supabase/postgres:15.6.1.143 \
        pg_basebackup \
            --host="${PRIMARY_PRIVATE}" \
            --port=5432 \
            --username="${REPL_USER}" \
            --pgdata=/var/lib/postgresql/data \
            --wal-method=stream \
            --slot="${SLOT_NAME}" \
            --checkpoint=fast \
            --progress \
            --verbose

    echo "  ✓ pg_basebackup completed"

    # Configure replica: create standby.signal and set primary_conninfo
    echo "  Configuring replica connection..."
    cat > "\${DB_DATA}/postgresql.auto.conf" <<PGCONF
primary_conninfo = 'host=${PRIMARY_PRIVATE} port=5432 user=${REPL_USER} password=${REPL_PASS} application_name=${SLOT_NAME}'
primary_slot_name = '${SLOT_NAME}'
PGCONF

    touch "\${DB_DATA}/standby.signal"
    echo "  ✓ standby.signal created, primary_conninfo set"
REMOTE
echo ""

# ── Step 9: Start replica Supabase stack and verify ──────────────────────
echo "[9/9] Starting Supabase stack on replica..."
run_replica bash -s <<REMOTE
    cd "${COMPOSE_DIR}"
    docker compose up -d
    echo "  Waiting 15s for containers to stabilize..."
    sleep 15

    # Verify DB is in recovery mode
    IN_RECOVERY=\$(docker exec supabase-db psql -U supabase_admin -t -c \
        "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')
    if [[ "\$IN_RECOVERY" == "t" ]]; then
        echo "  ✓ Replica DB is in recovery mode (hot standby active)"
    else
        echo "  ✗ Replica DB is NOT in recovery mode — check configuration"
    fi

    # Show container status
    echo ""
    echo "  Running containers:"
    docker ps --format '  {{.Names}}\t{{.Status}}' | grep -i supabase | sort
REMOTE
echo ""

# ── Verify replication from primary side ──────────────────────────────────
echo "=== Replication Verification (from primary) ==="
run_primary bash -s <<'REMOTE'
    echo "Active replication connections:"
    docker exec supabase-db psql -U supabase_admin -d postgres -c \
        "SELECT application_name, client_addr, state, sent_lsn, replay_lsn,
                pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes
         FROM pg_stat_replication;"

    echo ""
    echo "Replication slots:"
    docker exec supabase-db psql -U supabase_admin -d postgres -c \
        "SELECT slot_name, active, restart_lsn FROM pg_replication_slots;"
REMOTE

echo ""
echo "============================================================"
echo " Hot Standby Setup Complete"
echo "============================================================"
echo ""
echo "Primary: ${PRIMARY_HOST} (read-write)"
echo "Replica: ${REPLICA_HOST} (read-only hot standby)"
echo ""
echo "Monitor replication lag:"
echo "  ssh ${SSH_OPTS} ${SSH_USER}@${PRIMARY_HOST} \\"
echo "    'docker exec supabase-db psql -U supabase_admin -c \"SELECT * FROM pg_stat_replication;\"'"
echo ""
echo "Emergency failover (promote replica to primary):"
echo "  ssh ${SSH_OPTS} ${SSH_USER}@${REPLICA_HOST} \\"
echo "    'docker exec supabase-db pg_ctl promote -D /var/lib/postgresql/data'"
echo ""
echo "⚠ After promotion, update DNS and Worker secrets to point to ${REPLICA_HOST}"
echo "  See: CUTOVER_RUNBOOK.md → Rollback Procedure"
