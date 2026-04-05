# Event Hardening Status Tracker

- **Goal**: 20k concurrent users; p95 page<500ms; p95 auth<600ms; error rate<1%; no DB pool exhaustion.
- **Live Event Date**: Friday 2026-04-10 (confirm exact date in timeline.log).
- **Streaming**: Switcher Studio -> Facebook Live; embedded on site.
- **Phase gates**: [ ] P0, [ ] P1, [ ] P2, [ ] P3, [ ] P4, [ ] P5, [ ] Cutover, [ ] Rollback window.

## Known Risks + Mitigations

| Risk | Mitigation |
|------|-----------|
| DB connection exhaustion under 20k concurrency | PgBouncer transaction pooling (MAX_CLIENT_CONN=5000, DEFAULT_POOL_SIZE=50) |
| Bot/auth flooding during live event | Turnstile CAPTCHA on auth + Cloudflare WAF rate limits + Worker in-memory rate limiter |
| Stripe webhook replay attacks | Signature verification + event deduplication via process_stripe_webhook RPC |
| Live page slow under load | Edge caching (s-maxage=300), CF Cache API for stream status, Facebook embed offloads video |
| Self-hosted Supabase outage | 72-hour rollback window to Supabase Cloud; Caddy TLS + auto-renew |
| Data loss | Daily pg_dump + WAL archiving for PITR; restore verification script |
| SSH access uses ephemeral CloudShell IP | Replace with static office/VPN IP via `04-fix-ssh-security-group.sh` |

## Post-Deploy Operational Checklist

### Phase 1 — Fix SSH Security Groups
- [ ] Run `scripts/04-fix-ssh-security-group.sh <YOUR_STATIC_IP>` to replace CloudShell ephemeral IP (100.31.240.60/32)
- [ ] Verify SSH connectivity: `ssh -i ~/.ssh/sbbl-hq-key.pem ubuntu@52.21.231.157`
- Security groups: `sg-06b24129c2be7c5ab` (primary), `sg-0f60806d0eea6ba1b` (replica)

### Phase 2 — Download SSH Key from CloudShell
- [ ] Download `/tmp/sbbl-hq-key.pem` from CloudShell (Actions → Download file)
- [ ] Store locally: `~/.ssh/sbbl-hq-key.pem` with `chmod 400`
- ⚠ CloudShell resets periodically — download before session expires

### Phase 3 — Restart supabase-db for archive_mode
- [ ] `ssh ... 'cd /home/ubuntu/supabase-docker && sudo docker compose restart supabase-db'`
- [ ] Verify: `SHOW archive_mode;` returns `on`

### Phase 4 — Record Replicator Password
- [ ] Reset replicator password: `ALTER USER replicator PASSWORD '<new_pass>';`
- [ ] Store password securely (password manager / vault)

### Phase 5 — Turnstile Secret Key
- [ ] Add `GOTRUE_SECURITY_CAPTCHA_SECRET` to self-hosted `.env`
- [ ] Restart supabase-auth container

### Phase 6 — Database Restore (from Supabase Cloud)
- [ ] Dump roles: `supabase db dump --role-only -f roles.sql`
- [ ] Dump schema: `supabase db dump --no-data -f schema.sql`
- [ ] Dump data: `supabase db dump --data-only -f data.sql`
- [ ] Restore via SSH tunnel (`ssh -L 5432:localhost:5432`) or `docker exec`
- [ ] Verify: `SELECT count(*) FROM auth.users;`

### Phase 7 — EBS Snapshot Automation (DLM)
- [ ] Create IAM role `AWSDataLifecycleManagerDefaultRole`
- [ ] Create nightly snapshot policy (7-day retention, 03:00 UTC)
- [ ] Tag instance: `Name=sbbl-hq-pg-primary`

### Phase 8 — Hot Standby Replica
- [ ] Install PostgreSQL 16 on replica (3.83.9.123)
- [ ] Run `pg_basebackup` from primary (172.31.17.195)
- [ ] Verify replication: `SELECT * FROM pg_stat_replication;`
- [ ] Document failover command: `pg_ctl promote -D /var/lib/postgresql/16/main`

### Phase 9 — Cloudflare DNS + Workers Secrets
- [ ] Point `sbbl-hq.icu` A record to 52.21.231.157
- [ ] Set Worker secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- [ ] Update OAuth callback URLs (Google, GitHub): `https://sbbl-hq.icu/auth/v1/callback`

### Phase 10 — Validation Gates
- [ ] Run `scripts/05-post-deploy-validate.sh`
- [ ] Smoke tests: REST API, Auth health, Live page, TLS
- [ ] Load test: `k6 run --vus 5000 --duration 3m sbbl-auth-load-test.js`
- [ ] Configure monitoring alerts:
  - Postgres CPU > 80%
  - EBS disk > 80%
  - Replication lag > 5s

## Script Inventory

| Script | Purpose | Status |
|--------|---------|--------|
| `01-generate-keys.sh` | Generate JWT keys (ANON_KEY, SERVICE_ROLE_KEY) | Ready |
| `02-migrate-auth.sh` | Migrate auth.users + identities from Cloud | Ready |
| `03-validate-auth.sh` | Smoke test auth: HIBP, CAPTCHA, password policy | Ready |
| `04-fix-ssh-security-group.sh` | Replace ephemeral CloudShell IP in SG | Ready |
| `05-post-deploy-validate.sh` | Full post-deploy health check | Ready |
| `06-start-supabase-primary.sh` | SSH to primary, docker compose up -d, verify | Ready |
| `07-open-api-studio-ports.sh` | Open port 8000/3000 in SG for Studio access | Ready |
| `08-setup-hot-standby.sh` | Configure streaming replication on replica | Ready |
| `09-cutover.sh` | CF Worker secrets + DNS cutover + smoke test | Ready |
| `10-backup-nightly.sh` | pg_dump auth schema nightly to S3/local | Ready |
| `11-verify-backup.sh` | Restore backup into test instance + verify | Ready |
| `12-prune-backups.sh` | Delete backups older than 30 days | Ready |
| `13-promote-replica.sh` | Failover: promote standby to primary + DNS flip | Ready |
| `14-ebs-dlm-setup.sh` | AWS DLM nightly EBS snapshots (7-day retention) | Ready |
| `15-monitoring-alerts.sh` | CloudWatch alarms: CPU, disk, lag, errors | Ready |

## Load Test Inventory

| Test | Target | SLO |
|------|--------|-----|
| `tests/load-auth.js` | Auth: signup/login/OAuth under 5k VU | p95 < 600ms, error < 1% |
| `tests/load-realtime.js` | WebSocket: score subscriptions under 5k VU | p95 connect < 500ms, msg lag < 300ms |
| `tests/load-live-page.js` | Live page + standings + stream-status under 10k VU | p95 page < 500ms, p99 < 1500ms |

## Run Order (Event Day -3)

```
1. ./scripts/04-fix-ssh-security-group.sh <YOUR_IP>
2. ./scripts/06-start-supabase-primary.sh
3. ./scripts/07-open-api-studio-ports.sh
4. ./scripts/08-setup-hot-standby.sh
5. ./scripts/14-ebs-dlm-setup.sh
6. ./scripts/15-monitoring-alerts.sh
7. ./scripts/05-post-deploy-validate.sh
8. k6 run --env SUPABASE_URL=https://sbbl-hq.icu tests/load-auth.js
9. k6 run --env SUPABASE_URL=https://sbbl-hq.icu tests/load-live-page.js
10. k6 run --env SUPABASE_URL=https://sbbl-hq.icu tests/load-realtime.js
11. ./scripts/09-cutover.sh   # when all gates pass
```

## Failover Runbook (Emergency)

```
# If primary 52.21.231.157 is unreachable:
1. REPLICA_HOST=3.83.9.123 ./scripts/13-promote-replica.sh
2. Verify: curl -I https://sbbl-hq.icu/auth/v1/  # should 401
3. Update Worker secrets: echo 'https://sbbl-hq.icu' | wrangler secret put SUPABASE_URL
4. Once primary recovered: reconfigure as new replica via 08-setup-hot-standby.sh
```
  - 5xx rate > 1%
