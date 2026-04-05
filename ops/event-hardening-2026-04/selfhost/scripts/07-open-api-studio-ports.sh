#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 07-open-api-studio-ports.sh
# Open ports 8000 (Kong API gateway) and 3000 (Supabase Studio) in the
# primary and replica EC2 security groups.
#
# Usage:
#   ./07-open-api-studio-ports.sh [--source CIDR]
#
# Options:
#   --source CIDR   Restrict access to a specific IP/range (default: 0.0.0.0/0)
#                   For Studio (3000), consider restricting to your IP for security.
#
# Examples:
#   ./07-open-api-studio-ports.sh                         # Open to all
#   ./07-open-api-studio-ports.sh --source 203.0.113.0/24 # Restrict to subnet
#
# Requires: aws CLI configured with appropriate credentials
###############################################################################

# ── Security Group IDs ──────────────────────────────────────────────────────
SG_PRIMARY="sg-06b24129c2be7c5ab"
SG_REPLICA="sg-0f60806d0eea6ba1b"

# ── Parse arguments ─────────────────────────────────────────────────────────
SOURCE_CIDR="0.0.0.0/0"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --source)
            SOURCE_CIDR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--source CIDR]"
            exit 1
            ;;
    esac
done

echo "=== Open API & Studio Ports ==="
echo "SG Primary: ${SG_PRIMARY}"
echo "SG Replica: ${SG_REPLICA}"
echo "Source:     ${SOURCE_CIDR}"
echo ""

# ── Helper: add ingress rule (idempotent) ──────────────────────────────────
add_rule() {
    local sg_id="$1"
    local port="$2"
    local description="$3"

    echo "  Adding port ${port} to ${sg_id}..."
    if aws ec2 authorize-security-group-ingress \
        --group-id "$sg_id" \
        --protocol tcp \
        --port "$port" \
        --cidr "$SOURCE_CIDR" \
        --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=Name,Value=${description}}]" \
        2>/dev/null; then
        echo "    ✓ Port ${port} opened"
    else
        # Check if rule already exists
        EXISTING=$(aws ec2 describe-security-groups \
            --group-ids "$sg_id" \
            --query "SecurityGroups[0].IpPermissions[?FromPort==\`${port}\`].IpRanges[?CidrIp==\`${SOURCE_CIDR}\`]" \
            --output text 2>/dev/null)
        if [[ -n "$EXISTING" ]]; then
            echo "    ✓ Port ${port} already open (rule exists)"
        else
            echo "    ✗ Failed to open port ${port}"
            return 1
        fi
    fi
}

# ── Open ports on primary SG ──────────────────────────────────────────────
echo "[1/2] Primary security group (${SG_PRIMARY}):"
add_rule "$SG_PRIMARY" 8000 "sbbl-hq-kong-api"
add_rule "$SG_PRIMARY" 3000 "sbbl-hq-studio"
echo ""

# ── Open ports on replica SG ─────────────────────────────────────────────
echo "[2/2] Replica security group (${SG_REPLICA}):"
add_rule "$SG_REPLICA" 8000 "sbbl-hq-kong-api-replica"
add_rule "$SG_REPLICA" 3000 "sbbl-hq-studio-replica"
echo ""

# ── Verify ────────────────────────────────────────────────────────────────
echo "=== Verification ==="
for sg_id in "$SG_PRIMARY" "$SG_REPLICA"; do
    echo ""
    echo "Security Group: ${sg_id}"
    aws ec2 describe-security-groups \
        --group-ids "$sg_id" \
        --query "SecurityGroups[0].IpPermissions[?FromPort==\`8000\` || FromPort==\`3000\`].{Port:FromPort,CIDR:IpRanges[0].CidrIp}" \
        --output table 2>/dev/null || echo "  (could not verify — check AWS Console)"
done

echo ""
echo "Done. Ports 8000 (API) and 3000 (Studio) are now open."
echo ""
echo "⚠ Security note: Studio (port 3000) has its own username/password auth"
echo "  (DASHBOARD_USERNAME / DASHBOARD_PASSWORD in .env), but consider"
echo "  restricting port 3000 to your IP only:"
echo "  ./07-open-api-studio-ports.sh --source <YOUR_IP>/32"
echo ""
echo "Test connectivity:"
echo "  curl http://52.21.231.157:8000/rest/v1/ -H 'apikey: <anon-key>'"
echo "  open http://52.21.231.157:3000  (Studio dashboard)"
