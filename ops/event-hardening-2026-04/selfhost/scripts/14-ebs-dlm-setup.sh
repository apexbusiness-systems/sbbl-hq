#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 14-ebs-dlm-setup.sh
# Sets up AWS EBS Data Lifecycle Manager (DLM) for automated nightly
# snapshots of the Supabase primary and replica EBS volumes.
#
# Creates:
#   - IAM role: AWSDataLifecycleManagerDefaultRole (if not exists)
#   - DLM policy: nightly snapshot at 03:00 UTC, 7-day retention
#   - Tags primary instance: Name=sbbl-hq-pg-primary
#   - Tags replica instance: Name=sbbl-hq-pg-replica
#
# Usage:
#   AWS_REGION=us-east-1 ./14-ebs-dlm-setup.sh [--dry-run]
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - IAM permissions: dlm:*, iam:CreateRole, iam:AttachRolePolicy, ec2:CreateTags
###############################################################################

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && { DRY_RUN=true; echo "[DRY RUN] No changes will be made."; }

# ── Configuration ────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
PRIMARY_INSTANCE_ID="${PRIMARY_INSTANCE_ID:-i-0afd7c9e3e0df53c3}" # sbbl-hq primary EC2
REPLICA_INSTANCE_ID="${REPLICA_INSTANCE_ID:-}"                   # sbbl-hq replica EC2 (optional)
DLM_ROLE_NAME="AWSDataLifecycleManagerDefaultRole"
DLM_POLICY_NAME="sbbl-hq-nightly-snapshots"
SNAPSHOT_HOUR="03"    # 03:00 UTC
RETENTION_COUNT=7     # keep 7 daily snapshots

die() { echo "ERROR: $*" >&2; exit 1; }
aw() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] aws $*"
    return 0
  fi
  aws --region "$AWS_REGION" "$@"
}

command -v aws &>/dev/null || die "AWS CLI not found. Install: https://aws.amazon.com/cli/"

echo "=== SBBL-HQ EBS DLM Snapshot Setup ==="
echo "Region:  ${AWS_REGION}"
echo "Primary: ${PRIMARY_INSTANCE_ID}"
echo "Replica: ${REPLICA_INSTANCE_ID:-not set}"
echo ""

# ── Step 1: Tag EC2 instances for DLM targeting ──────────────────────────────
echo "[1/4] Tagging EC2 instances..."
if [[ -n "$PRIMARY_INSTANCE_ID" ]]; then
  aw ec2 create-tags \
    --resources "$PRIMARY_INSTANCE_ID" \
    --tags Key=Name,Value=sbbl-hq-pg-primary Key=DLMSnapshot,Value=true Key=Role,Value=postgres-primary
  echo "  ✓ Tagged primary: ${PRIMARY_INSTANCE_ID} → Name=sbbl-hq-pg-primary, DLMSnapshot=true"
fi
if [[ -n "$REPLICA_INSTANCE_ID" ]]; then
  aw ec2 create-tags \
    --resources "$REPLICA_INSTANCE_ID" \
    --tags Key=Name,Value=sbbl-hq-pg-replica Key=DLMSnapshot,Value=true Key=Role,Value=postgres-replica
  echo "  ✓ Tagged replica: ${REPLICA_INSTANCE_ID} → Name=sbbl-hq-pg-replica, DLMSnapshot=true"
fi

# ── Step 2: Create DLM IAM role (if not exists) ──────────────────────────────
echo "[2/4] Ensuring IAM role ${DLM_ROLE_NAME}..."
ROLE_EXISTS=$(aws iam get-role --role-name "$DLM_ROLE_NAME" 2>/dev/null && echo yes || echo no)
if [[ "$ROLE_EXISTS" == "no" ]]; then
  TRUST_POLICY=$(cat <<'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "dlm.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
TRUST
)
  if [[ "$DRY_RUN" == false ]]; then
    aws iam create-role \
      --role-name "$DLM_ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --description "Role for EBS Data Lifecycle Manager" \
      --region "$AWS_REGION"
    aws iam attach-role-policy \
      --role-name "$DLM_ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole
    echo "  ✓ IAM role created and policy attached"
  else
    echo "[dry-run] Would create IAM role ${DLM_ROLE_NAME}"
  fi
else
  echo "  ✓ IAM role already exists"
fi

# Get role ARN
if [[ "$DRY_RUN" == false ]]; then
  DLM_ROLE_ARN=$(aws iam get-role --role-name "$DLM_ROLE_NAME" \
    --query 'Role.Arn' --output text)
else
  DLM_ROLE_ARN="arn:aws:iam::123456789012:role/${DLM_ROLE_NAME}"
fi
echo "  Role ARN: ${DLM_ROLE_ARN}"

# ── Step 3: Create DLM lifecycle policy ─────────────────────────────────────
echo "[3/4] Creating DLM lifecycle policy..."
POLICY_DETAILS=$(cat <<EOF
{
  "ResourceTypes": ["INSTANCE"],
  "TargetTags": [{"Key": "DLMSnapshot", "Value": "true"}],
  "Schedules": [{
    "Name": "sbbl-hq-nightly",
    "CreateRule": {
      "Interval": 24,
      "IntervalUnit": "HOURS",
      "Times": ["${SNAPSHOT_HOUR}:00"]
    },
    "RetainRule": {
      "Count": ${RETENTION_COUNT}
    },
    "CopyTags": true,
    "TagsToAdd": [
      {"Key": "CreatedBy", "Value": "DLM"},
      {"Key": "Project", "Value": "sbbl-hq"}
    ]
  }]
}
EOF
)

if [[ "$DRY_RUN" == false ]]; then
  POLICY_ID=$(aw dlm create-lifecycle-policy \
    --description "${DLM_POLICY_NAME}: nightly EBS snapshots 7-day retention" \
    --state ENABLED \
    --execution-role-arn "$DLM_ROLE_ARN" \
    --policy-details "$POLICY_DETAILS" \
    --query 'PolicyId' --output text)
  echo "  ✓ DLM policy created: ${POLICY_ID}"
  echo "  Snapshots taken nightly at ${SNAPSHOT_HOUR}:00 UTC, retaining ${RETENTION_COUNT} copies"
else
  echo "[dry-run] Would create DLM policy with:"
  echo "  Schedule: daily at ${SNAPSHOT_HOUR}:00 UTC"
  echo "  Retention: ${RETENTION_COUNT} snapshots"
  echo "  Target: instances tagged DLMSnapshot=true"
fi

# ── Step 4: Verify and print summary ─────────────────────────────────────────
echo "[4/4] Listing DLM policies..."
if [[ "$DRY_RUN" == false ]]; then
  aws dlm get-lifecycle-policies \
    --region "$AWS_REGION" \
    --query 'Policies[?Description!=`null`].[PolicyId,Description,State]' \
    --output table 2>/dev/null || echo "  (Could not list policies — check AWS permissions)"
fi

echo ""
echo "=== DLM Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Verify first snapshot appears in EC2 → Snapshots within 24h"
echo "  2. Test restore: aws ec2 create-volume --snapshot-id snap-XXXX --availability-zone us-east-1a"
echo "  3. Monitor disk usage: watch 'df -h /var/lib/docker'"
echo "  4. Set CloudWatch alarm for EBS disk > 80% — run scripts/15-monitoring-alerts.sh"
