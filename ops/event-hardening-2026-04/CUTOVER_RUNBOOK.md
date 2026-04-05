# Cutover Runbook — Supabase Cloud to Self-Hosted

## Overview

Deterministic cutover procedure for migrating SBBL-HQ from Supabase Cloud
(`ezanilxygnpucwkwpsoc.supabase.co`) to self-hosted Supabase on a dedicated
server behind Caddy + PgBouncer.

**Rollback window**: 72 hours after cutover.

---

## Timeline

### T-24h: Prep and Full Sync

1. Run full backup of Supabase Cloud:
   ```bash
   pg_dump --no-owner --no-acl -Fc \
     "postgresql://postgres:<password>@db.ezanilxygnpucwkwpsoc.supabase.co:5432/postgres" \
     > /backups/cloud-final-$(date +%Y%m%d).dump
   ```
2. Restore to self-hosted Postgres:
   ```bash
   pg_restore --clean --if-exists -d postgres \
     /backups/cloud-final-$(date +%Y%m%d).dump
   ```
3. Verify row counts match across key tables (`profiles`, `orders`, `tickets`, `comments`).
4. Confirm Caddy TLS certs are valid:
   ```bash
   curl -vI https://api.sbbl-hq.icu 2>&1 | grep "SSL certificate"
   ```
5. Run 5k VU load test against self-hosted:
   ```bash
   k6 run --vus 5000 --duration 5m ops/event-hardening-2026-04/scripts/load-test.js
   ```
6. Record results in `LOAD_TEST_RESULTS.md`.

### T-2h: Soft Read-Only and Incremental Sync

1. Put Supabase Cloud into soft read-only. Options:
   - Set application-level flag: `READONLY=true` in Worker env
   - Or apply RLS policy restricting writes:
     ```sql
     -- On cloud instance
     ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "readonly" ON public.orders FOR INSERT WITH CHECK (false);
     CREATE POLICY "readonly" ON public.orders FOR UPDATE USING (false);
     -- Repeat for other mutable tables
     ```
2. Run incremental sync of `auth.users` and recent data:
   ```bash
   # Export auth.users created/updated in last 24h
   psql "$CLOUD_DB_URL" -c \
     "COPY (SELECT * FROM auth.users WHERE updated_at > now() - interval '24 hours') TO STDOUT WITH CSV HEADER" \
     > /tmp/auth_users_delta.csv

   # Import to self-hosted
   psql "$SELFHOST_DB_URL" -c "\COPY auth.users FROM '/tmp/auth_users_delta.csv' WITH CSV HEADER"
   ```
3. Verify `auth.users` count matches.
4. Verify recent orders/data are present on self-hosted.

### T-15m: Update Cloudflare Worker Secrets and Deploy

1. Update Worker secrets:
   ```bash
   cd /home/user/sbbl-hq
   echo "https://api.sbbl-hq.icu" | wrangler secret put SUPABASE_URL
   echo "<self-hosted-anon-key>" | wrangler secret put SUPABASE_ANON_KEY
   echo "<self-hosted-service-role-key>" | wrangler secret put SUPABASE_SERVICE_KEY
   wrangler deploy
   ```
2. Update Stripe webhook endpoint URL if the Supabase URL changed:
   ```bash
   stripe webhooks update we_xxx --url https://sbbl-hq.icu/webhooks/stripe
   ```
   Or update manually in Stripe Dashboard: Settings > Webhooks > Update endpoint URL.

### T0: Cutover Verification

Run each check and confirm pass:

| Check | Command / Action | Expected |
|-------|-----------------|----------|
| Health endpoint | `curl https://sbbl-hq.icu/ops/health` | Returns self-hosted URL |
| Auth login | Sign in with test account on /login | Success, JWT issued |
| Live page | Load /live in browser | Page renders, stream embed loads |
| Stripe webhook | `stripe trigger checkout.session.completed` | 200 response, order created in self-hosted DB |

All four checks must pass. If any fail, evaluate rollback (see criteria below).

**Mark cutover complete**: update ops Slack channel / status page.

### T+1h: Post-Cutover Monitoring

1. Monitor error rates in Cloudflare Analytics and server logs.
2. Check DB connections:
   ```bash
   psql "$SELFHOST_DB_URL" -c "SELECT count(*) FROM pg_stat_activity;"
   ```
3. Check Caddy logs:
   ```bash
   journalctl -u caddy --since "1 hour ago" | grep -c "5[0-9][0-9]"
   ```
4. If event has not started, run 20k VU load test:
   ```bash
   k6 run --vus 20000 --duration 5m ops/event-hardening-2026-04/scripts/load-test.js
   ```

### T+72h: End Rollback Window

1. Rollback window closes.
2. Optionally decommission Supabase Cloud project to stop billing.
3. Remove soft read-only policies from cloud (if keeping as cold backup).

---

## DNS Changes

If using a custom domain for the Supabase API (e.g., `api.sbbl-hq.icu`):

1. **Before cutover** (T-24h): Lower TTL to 300s (5 minutes).
   ```
   api.sbbl-hq.icu  A  <self-hosted-server-ip>  TTL=300
   ```
2. **At cutover** (T0): Update DNS A/CNAME record to point to self-hosted server IP.
3. **Enable Cloudflare proxy** (orange cloud) for DDoS protection.
4. **After stabilization** (T+72h): Restore TTL to 3600s.

---

## Worker Secret Changes

```bash
cd /home/user/sbbl-hq
echo "https://api.sbbl-hq.icu" | wrangler secret put SUPABASE_URL
echo "<self-hosted-anon-key>" | wrangler secret put SUPABASE_ANON_KEY
echo "<self-hosted-service-role-key>" | wrangler secret put SUPABASE_SERVICE_KEY
wrangler deploy
```

---

## Stripe Webhook Endpoint

- **Dashboard**: Stripe Dashboard > Settings > Webhooks > Update endpoint URL to `https://sbbl-hq.icu/webhooks/stripe`
- **CLI**:
  ```bash
  stripe webhooks update we_xxx --url https://sbbl-hq.icu/webhooks/stripe
  ```
- **Test**:
  ```bash
  stripe trigger checkout.session.completed
  ```

---

## Cloudflare WAF Changes

1. Enable rate limiting rules (documented in `ops/cloudflare/RATE_LIMIT_RULES.md`).
2. Enable Bot Fight Mode in Cloudflare Dashboard > Security > Bots.
3. Enable Under Attack mode if needed during event (Dashboard > Overview > Under Attack Mode).

---

## Rollback Procedure

### Rollback Decision Criteria

Initiate rollback if ANY of the following occur:

- Self-hosted DB CPU > 90% sustained for 5+ minutes
- Auth error rate > 5% for 3+ minutes
- Checkout failures > 2% for 2+ minutes
- Caddy TLS cert failure (cert expired or ACME renewal failing)
- Postgres OOM or crash (check `dmesg` / `journalctl`)

### Rollback Commands

```bash
# Step 1: Revert Worker secrets to Supabase Cloud
echo "https://ezanilxygnpucwkwpsoc.supabase.co" | wrangler secret put SUPABASE_URL
echo "<cloud-anon-key>" | wrangler secret put SUPABASE_ANON_KEY
echo "<cloud-service-role-key>" | wrangler secret put SUPABASE_SERVICE_KEY
wrangler deploy

# Step 2: Revert Stripe webhook to cloud URL
stripe webhooks update we_xxx --url https://sbbl-hq.icu/webhooks/stripe-cloud
# Or update in Stripe Dashboard

# Step 3: Revert DNS if changed
# Update api.sbbl-hq.icu to point back to Supabase Cloud
# Or remove the custom domain record

# Step 4: Remove soft read-only policies from cloud
# psql "$CLOUD_DB_URL" -c "DROP POLICY readonly ON public.orders;" etc.

# Step 5: Verify app works with cloud backend
curl https://sbbl-hq.icu/ops/health
# Should return Supabase Cloud URL
```

### Post-Rollback

1. Sync any data written to self-hosted during cutover back to cloud.
2. Investigate root cause of failure.
3. Schedule retry after fixes applied.
