#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 04-fix-ssh-security-group.sh
# Replace CloudShell ephemeral SSH IP with a real static office/VPN IP
# in the EC2 security groups for the self-hosted Supabase deployment.
#
# Usage:
#   ./04-fix-ssh-security-group.sh <YOUR_STATIC_IP>
#
# Example:
#   ./04-fix-ssh-security-group.sh 203.0.113.42
#
# Requires: aws CLI configured with appropriate credentials
###############################################################################

# ── Security Group IDs ──────────────────────────────────────────────────────
SG_PRIMARY="sg-06b24129c2be7c5ab"
SG_REPLICA="sg-0f60806d0eea6ba1b"
OLD_CIDR="100.31.240.60/32"

# ── Validate input ──────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <YOUR_STATIC_IP>"
    echo "  e.g. $0 203.0.113.42"
    exit 1
fi

NEW_IP="$1"

# Basic IPv4 validation
if ! [[ "$NEW_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: '$NEW_IP' does not look like a valid IPv4 address."
    exit 1
fi

NEW_CIDR="${NEW_IP}/32"

echo "=== SSH Security Group Update ==="
echo "Old CIDR : ${OLD_CIDR}"
echo "New CIDR : ${NEW_CIDR}"
echo "SG Primary: ${SG_PRIMARY}"
echo "SG Replica: ${SG_REPLICA}"
echo ""

# ── Remove old CloudShell ephemeral IP ──────────────────────────────────────
echo "[1/4] Revoking old SSH ingress from ${SG_PRIMARY}..."
aws ec2 revoke-security-group-ingress \
    --group-id "$SG_PRIMARY" \
    --protocol tcp \
    --port 22 \
    --cidr "$OLD_CIDR" 2>/dev/null || echo "  (rule already removed or not found)"

echo "[2/4] Revoking old SSH ingress from ${SG_REPLICA}..."
aws ec2 revoke-security-group-ingress \
    --group-id "$SG_REPLICA" \
    --protocol tcp \
    --port 22 \
    --cidr "$OLD_CIDR" 2>/dev/null || echo "  (rule already removed or not found)"

# ── Add new static IP ──────────────────────────────────────────────────────
echo "[3/4] Authorizing SSH ingress ${NEW_CIDR} on ${SG_PRIMARY}..."
aws ec2 authorize-security-group-ingress \
    --group-id "$SG_PRIMARY" \
    --protocol tcp \
    --port 22 \
    --cidr "$NEW_CIDR"

echo "[4/4] Authorizing SSH ingress ${NEW_CIDR} on ${SG_REPLICA}..."
aws ec2 authorize-security-group-ingress \
    --group-id "$SG_REPLICA" \
    --protocol tcp \
    --port 22 \
    --cidr "$NEW_CIDR"

# ── Verify ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Verification ==="
echo "Primary SG SSH rules:"
aws ec2 describe-security-groups \
    --group-ids "$SG_PRIMARY" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`22\`].IpRanges[].CidrIp" \
    --output text

echo "Replica SG SSH rules:"
aws ec2 describe-security-groups \
    --group-ids "$SG_REPLICA" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`22\`].IpRanges[].CidrIp" \
    --output text

echo ""
echo "Done. SSH access is now restricted to ${NEW_CIDR}."
echo "Test connectivity: ssh -i ~/.ssh/sbbl-hq-key.pem ubuntu@52.21.231.157"
