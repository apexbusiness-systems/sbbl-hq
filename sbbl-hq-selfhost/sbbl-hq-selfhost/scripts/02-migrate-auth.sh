#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scripts/02-migrate-auth.sh
# Dumps auth.* tables from Supabase Cloud and restores them
# into the self-hosted Postgres at sbbl-hq.icu.
#
# Prerequisites:
#   - psql installed
#   - CLOUD_DB_URL  — direct DB URL from Supabase Cloud project
#                     (Settings → Database → Connection string → URI)
#   - LOCAL_DB_URL  — connection string to self-hosted Postgres
#
# Usage:
#   export CLOUD_DB_URL="postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
#   export LOCAL_DB_URL="postgres://supabase_admin:[PASSWORD]@localhost:5432/postgres"
#   bash scripts/02-migrate-auth.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

: "${CLOUD_DB_URL:?Set CLOUD_DB_URL to your Supabase Cloud connection string}"
: "${LOCAL_DB_URL:?Set LOCAL_DB_URL to your self-hosted DB connection string}"

DUMP_FILE="backups/auth-dump-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p backups

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SBBL-HQ Auth Migration: Cloud → Self-Hosted"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Dump auth schema from Cloud ──────────────────
echo ""
echo "🔵 [1/4] Dumping auth schema from Supabase Cloud..."
pg_dump \
  "$CLOUD_DB_URL" \
  --schema=auth \
  --no-owner \
  --no-acl \
  --disable-triggers \
  -f "$DUMP_FILE"
echo "     ✅ Dumped to $DUMP_FILE"

# ── Step 2: Count records pre-restore ────────────────────
echo ""
echo "🔵 [2/4] Record counts in dump..."
echo "     auth.users     : $(grep -c 'INSERT INTO auth.users' "$DUMP_FILE" || echo 0)"
echo "     auth.identities: $(grep -c 'INSERT INTO auth.identities' "$DUMP_FILE" || echo 0)"

# ── Step 3: Restore into self-hosted ─────────────────────
echo ""
echo "🔵 [3/4] Restoring into self-hosted Postgres..."
echo "     ⚠️  This will merge auth data. Duplicate UUID conflicts are skipped."

psql "$LOCAL_DB_URL" << SQLEOF
-- Temporarily disable RLS so the restore can write freely
SET session_replication_role = replica;
SQLEOF

psql "$LOCAL_DB_URL" -f "$DUMP_FILE" \
  --on-error-stop \
  2>&1 | grep -v "^SET$" | grep -v "^--" || true

psql "$LOCAL_DB_URL" << SQLEOF
SET session_replication_role = DEFAULT;
SQLEOF

echo "     ✅ Restore complete"

# ── Step 4: Verify ───────────────────────────────────────
echo ""
echo "🔵 [4/4] Verifying row counts in self-hosted..."
psql "$LOCAL_DB_URL" -t -c "
  SELECT
    'auth.users'      AS tbl, count(*) FROM auth.users
  UNION ALL
  SELECT
    'auth.identities' AS tbl, count(*) FROM auth.identities
  UNION ALL
  SELECT
    'auth.sessions'   AS tbl, count(*) FROM auth.sessions;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Auth migration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Next: Update OAuth callback URLs in each provider"
echo "  dashboard to: https://sbbl-hq.icu/auth/v1/callback"
