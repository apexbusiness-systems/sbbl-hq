#!/usr/bin/env bash
set -euo pipefail
###############################################################################
# 15-monitoring-alerts.sh
# Creates CloudWatch alarms for the SBBL-HQ self-hosted Supabase deployment.
#
# Alarms created:
#   - Postgres CPU      > 80% for 2 consecutive 5-min periods
#   - EBS disk usage    > 80% (via CloudWatch agent disk_used_percent)
#   - Replication lag   > 5s  (custom metric published by 10-backup-nightly.sh)
#   - HTTP 5xx rate     > 1%  (via ALB or custom metric)
#   - Instance StatusCheck failure
#
# Usage:
#   AWS_REGION=us-east-1 SNS_EMAIL=ops@example.com ./15-monitoring-alerts.sh
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - CloudWatch agent running on EC2 (for disk metrics)
#   - SNS_EMAIL env var set for alert notifications
#   - PRIMARY_INSTANCE_ID env var set
###############################################################################

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && { DRY_RUN=true; echo "[DRY RUN] No changes will be made."; }

# -- Configuration -----------------------------------------------------------
AWS_REGION="${AWS_REGION:-us-east-1}"
PRIMARY_INSTANCE_ID="${PRIMARY_INSTANCE_ID:-i-0afd7c9e3e0df53c3}"
REPLICA_INSTANCE_ID="${REPLICA_INSTANCE_ID:-}"
SNS_EMAIL="${SNS_EMAIL:-}"
SNS_TOPIC_NAME="sbbl-hq-alerts"
ALARM_PREFIX="sbbl-hq"

die() { echo "ERROR: $*" >&2; exit 1; }
aw() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] aws --region ${AWS_REGION} $*"
    return 0
  fi
  aws --region "$AWS_REGION" "$@"
}

command -v aws &>/dev/null || die "AWS CLI not found"

echo "=== SBBL-HQ CloudWatch Monitoring Alerts ==="
echo "Region:   ${AWS_REGION}"
echo "Instance: ${PRIMARY_INSTANCE_ID}"
echo ""

# -- Step 1: Create SNS topic and subscribe email ----------------------------
echo "[1/4] Setting up SNS topic ${SNS_TOPIC_NAME}..."
if [[ "$DRY_RUN" == false ]]; then
  SNS_TOPIC_ARN=$(aws sns create-topic \
    --name "$SNS_TOPIC_NAME" \
    --region "$AWS_REGION" \
    --query 'TopicArn' --output text)
  echo "  Topic ARN: ${SNS_TOPIC_ARN}"
  if [[ -n "$SNS_EMAIL" ]]; then
    aws sns subscribe \
      --topic-arn "$SNS_TOPIC_ARN" \
      --protocol email \
      --notification-endpoint "$SNS_EMAIL" \
      --region "$AWS_REGION" > /dev/null
    echo "  Subscription confirmation sent to: ${SNS_EMAIL}"
    echo "  ACTION REQUIRED: Confirm the subscription email before alarms can fire."
  fi
else
  SNS_TOPIC_ARN="arn:aws:sns:${AWS_REGION}:123456789012:${SNS_TOPIC_NAME}"
  echo "[dry-run] SNS topic ARN: ${SNS_TOPIC_ARN}"
fi

# -- Step 2: EC2 CPU and status alarms ---------------------------------------
echo "[2/4] Creating EC2 instance alarms..."
create_alarm() {
  local name="$1" metric="$2" namespace="$3" stat="$4"
  local threshold="$5" comparison="$6" periods="$7" description="$8"
  shift 8
  aw cloudwatch put-metric-alarm \
    --alarm-name "${ALARM_PREFIX}-${name}" \
    --alarm-description "${description}" \
    --metric-name "$metric" \
    --namespace "$namespace" \
    --statistic "$stat" \
    --period 300 \
    --evaluation-periods "$periods" \
    --threshold "$threshold" \
    --comparison-operator "$comparison" \
    --treat-missing-data notBreaching \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --ok-actions "$SNS_TOPIC_ARN" \
    "$@"
  echo "  + ${ALARM_PREFIX}-${name}"
}

# CPU utilization > 80% for 10 min
create_alarm "primary-cpu-high" CPUUtilization AWS/EC2 Average \
  80 GreaterThanThreshold 2 \
  "Primary EC2 CPU > 80%" \
  --dimensions "Name=InstanceId,Value=${PRIMARY_INSTANCE_ID}"

# EC2 status check failure
create_alarm "primary-status-check" StatusCheckFailed AWS/EC2 Maximum \
  1 GreaterThanOrEqualToThreshold 1 \
  "Primary EC2 status check failed" \
  --dimensions "Name=InstanceId,Value=${PRIMARY_INSTANCE_ID}"

# EBS disk used > 80% (requires CloudWatch agent with disk metrics)
create_alarm "primary-disk-high" disk_used_percent CWAgent Average \
  80 GreaterThanThreshold 1 \
  "Primary EC2 disk usage > 80%" \
  --dimensions "Name=InstanceId,Value=${PRIMARY_INSTANCE_ID}" \
                "Name=path,Value=/" \
                "Name=device,Value=nvme0n1p1" \
                "Name=fstype,Value=ext4"

# Network out anomaly (potential DDoS or exfil) - 1 GB/5min threshold
create_alarm "primary-network-out-high" NetworkOut AWS/EC2 Average \
  1073741824 GreaterThanThreshold 1 \
  "Primary EC2 outbound network > 1GB/5min" \
  --dimensions "Name=InstanceId,Value=${PRIMARY_INSTANCE_ID}"

if [[ -n "$REPLICA_INSTANCE_ID" ]]; then
  create_alarm "replica-cpu-high" CPUUtilization AWS/EC2 Average \
    80 GreaterThanThreshold 2 \
    "Replica EC2 CPU > 80%" \
    --dimensions "Name=InstanceId,Value=${REPLICA_INSTANCE_ID}"
  create_alarm "replica-status-check" StatusCheckFailed AWS/EC2 Maximum \
    1 GreaterThanOrEqualToThreshold 1 \
    "Replica EC2 status check failed" \
    --dimensions "Name=InstanceId,Value=${REPLICA_INSTANCE_ID}"
fi

# -- Step 3: Custom metrics alarms (replication lag, auth errors) -------------
echo "[3/4] Creating custom metric alarms..."

# Replication lag > 5s (metric published by check-replication-lag in cron)
create_alarm "replication-lag-high" ReplicationLagSeconds SbblHQ Average \
  5 GreaterThanThreshold 1 \
  "PostgreSQL replication lag > 5 seconds"

# Auth error rate > 1% (metric published by validate-auth script or app)
create_alarm "auth-error-rate-high" AuthErrorRate SbblHQ Average \
  1 GreaterThanThreshold 2 \
  "Auth error rate > 1% for 10 minutes"

# PgBouncer pool exhaustion (metric from pgbouncer_exporter or custom script)
create_alarm "pgbouncer-pool-wait-high" PoolWaitingClients SbblHQ Maximum \
  100 GreaterThanThreshold 1 \
  "PgBouncer waiting clients > 100 (pool near exhaustion)"

# -- Step 4: Print alarm summary ---------------------------------------------
echo "[4/4] Alarm summary:"
if [[ "$DRY_RUN" == false ]]; then
  aws cloudwatch describe-alarms \
    --alarm-name-prefix "${ALARM_PREFIX}" \
    --region "$AWS_REGION" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Threshold:Threshold}' \
    --output table 2>/dev/null || echo "  (no alarms found yet)"
fi

echo ""
echo "=== Monitoring Setup Complete ==="
echo ""
echo "Custom metrics (SbblHQ namespace) must be published by:"
echo "  - ReplicationLagSeconds: add to 10-backup-nightly.sh cron or separate cron job"
echo "  - AuthErrorRate: add to application Cloudflare Worker or self-hosted GoTrue"
echo "  - PoolWaitingClients: add pgbouncer stats scraper cron"
echo ""
echo "CloudWatch Agent must be installed on EC2 for disk metrics:"
echo "  sudo apt install amazon-cloudwatch-agent"
echo "  sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard"
echo ""
echo "View alarms: https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home#alarmsV2:"
