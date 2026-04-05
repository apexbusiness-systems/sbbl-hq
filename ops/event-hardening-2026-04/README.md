# Event Hardening — April 2026

## What and Why

SBBL-HQ is a live basketball event platform. For the April 2026 event, we hardened
the stack to handle 20,000+ concurrent users during a live game with simultaneous
streaming, chat, and merchandise checkout.

The primary risk was Supabase Cloud's shared infrastructure hitting rate limits or
performance degradation under burst traffic from a single tenant. The solution was
migrating to self-hosted Supabase on dedicated hardware, combined with edge-level
protections via Cloudflare.

## Architecture

```
User Browser
    |
    v
Cloudflare CDN + WAF (rate limiting, bot protection, Turnstile CAPTCHA)
    |
    v
Cloudflare Worker (auth, routing, CSP headers, Stripe webhook verification)
    |
    v
Self-Hosted Supabase
    |-- Caddy (reverse proxy, automatic TLS)
    |-- Supabase GoTrue (auth)
    |-- Supabase PostgREST (API)
    |-- Supabase Realtime (WebSocket subscriptions)
    |-- PgBouncer (connection pooling)
    |-- PostgreSQL 15 (data)
```

### Streaming Path

```
Camera -> Switcher Studio -> Facebook Live -> Embedded on /live page via iframe
```

The stream is served entirely by Facebook's CDN. SBBL-HQ only hosts the embed
and the surrounding UI (chat, merch sidebar, event info).

## Key Hardening Measures

| Measure | Purpose |
|---------|---------|
| **Turnstile CAPTCHA** | Bot protection on signup and checkout |
| **Content Security Policy (CSP)** | Prevent XSS, restrict iframe sources |
| **Cloudflare Rate Limiting** | Throttle auth, checkout, and chat abuse |
| **Stripe Idempotency Keys** | Prevent duplicate charges on retry |
| **Edge Caching** | Cache static assets and /live page shell at Cloudflare edge |
| **PgBouncer** | Connection pooling to prevent Postgres connection exhaustion |
| **Self-Hosted Supabase** | Dedicated resources, no shared tenant limits |
| **Caddy Auto-TLS** | Automatic cert provisioning and renewal |

## How to Operate

### Start the Stack

```bash
cd /home/user/sbbl-hq/ops/event-hardening-2026-04/selfhost
docker compose up -d
```

### Check Health

```bash
# Self-hosted Supabase health
curl https://api.sbbl-hq.icu/rest/v1/ -H "apikey: <anon-key>"

# Worker health
curl https://sbbl-hq.icu/ops/health

# Postgres connections
docker exec supabase-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# PgBouncer stats
docker exec supabase-pgbouncer psql -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
```

### Run Backups

```bash
# Automated via cron (see selfhost/cron/backup.sh)
# Manual backup:
docker exec supabase-db pg_dump -U postgres -Fc postgres > /backups/manual-$(date +%Y%m%d-%H%M).dump
```

### Run Load Tests

```bash
# 5k VU test
k6 run --vus 5000 --duration 5m ops/event-hardening-2026-04/scripts/load-test.js

# 20k VU test
k6 run --vus 20000 --duration 5m ops/event-hardening-2026-04/scripts/load-test.js

# 50k VU test (use distributed k6 cloud or multiple machines)
k6 run --vus 50000 --duration 5m ops/event-hardening-2026-04/scripts/load-test.js
```

Record results in `LOAD_TEST_RESULTS.md`.

## Rollback Procedure

Full rollback procedure is documented in `CUTOVER_RUNBOOK.md`.

Summary: revert Worker secrets to Supabase Cloud URLs, redeploy Worker, revert
Stripe webhook URL, revert DNS. Rollback window is 72 hours after cutover.

## File Structure

```
ops/
  event-hardening-2026-04/
    README.md                  -- This file
    CUTOVER_RUNBOOK.md         -- Step-by-step cutover and rollback procedure
    LOAD_TEST_RESULTS.md       -- Template for recording load test results
    scripts/                   -- k6 load test scripts, utility scripts
    selfhost/                  -- Docker Compose, Caddy config, PgBouncer config
    logs/                      -- Test run logs, monitoring exports
    notes/                     -- Planning notes, decision records
    artifacts/                 -- Generated artifacts (certs, dumps, exports)
  cloudflare/
    RATE_LIMIT_RULES.md        -- Cloudflare WAF rate limiting rule definitions
```
