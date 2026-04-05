<!-- Version: v1.0.0 | Date: 2026-04-04 | Status: Current -->
# Supabase Usage Monitoring Runbook

**Version:** 1.0.0  
**Date:** 2026-04-04  
**Owner:** Platform Engineering  
**Status:** Active

---

## Purpose

This runbook covers monitoring, alerting, and cost-control procedures for the SBBL HQ Supabase project. It provides metric thresholds, escalation procedures, and remediation steps for the three primary cost drivers: Database Egress, Realtime Connections, and Edge Function Invocations.

---

## 1. Key Metrics and Alert Thresholds

### 1.1 Database

| Metric | Green | Yellow (Warning) | Red (Action Required) |
|--------|-------|-------------------|-----------------------|
| DB Size (GB) | < 4 GB | 4–7 GB | > 7 GB |
| Active Connections | < 80 | 80–150 | > 150 |
| Row Reads / hr | < 5 M | 5–15 M | > 15 M |
| Row Writes / hr | < 500 K | 500 K–2 M | > 2 M |
| Slow Queries (> 100 ms) | 0 | 1–5 / min | > 5 / min |
| Egress (GB / day) | < 1 GB | 1–4 GB | > 4 GB |

### 1.2 Realtime

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Peak Concurrent Connections | < 200 | 200–400 | > 400 |
| Messages / sec | < 100 | 100–300 | > 300 |
| Channel Count | < 50 | 50–100 | > 100 |

> **Current subscription inventory (audited 2026-04-04):**
> - `stream-reactions-{gameId}` — Live page only, filtered by `game_id`, unsubscribed on unmount ✓  
> - `mvw_standings` — (optional) Teams page, postgres_changes on materialized view (if Realtime publication enabled) ✓  
> - Auth `onAuthStateChange` — Supabase Auth internal, not counted as a custom channel ✓  
>
> No unfiltered or always-on Realtime subscriptions exist. All channels are cleaned up on component unmount.

### 1.3 Edge Functions

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Invocations / day | < 50 K | 50–200 K | > 200 K |
| Avg Duration (ms) | < 200 ms | 200–500 ms | > 500 ms |
| Error Rate | < 0.1 % | 0.1–1 % | > 1 % |
| Memory Usage | < 64 MB | 64–128 MB | > 128 MB |

### 1.4 Storage

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Total Storage (GB) | < 20 GB | 20–40 GB | > 40 GB |
| Egress (GB / day) | < 2 GB | 2–8 GB | > 8 GB |

### 1.5 Auth

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| MAU | < 8 K | 8–18 K | > 18 K |
| New Signups / day | < 200 | 200–500 | > 500 |
| Auth Errors / hr | < 10 | 10–50 | > 50 |

---

## 2. Cost Tier Boundaries (Supabase Pro)

| Resource | Free Tier | Pro Tier Included | Overage Rate |
|----------|-----------|-------------------|--------------|
| DB Size | 500 MB | 8 GB | $0.125 / GB / mo |
| Egress | 2 GB / mo | 250 GB / mo | $0.09 / GB |
| Storage | 1 GB | 100 GB | $0.021 / GB / mo |
| Edge Fn Invocations | 500 K / mo | 2 M / mo | $2 / 1 M |
| Realtime Messages | 2 M / mo | 5 M / mo | $2.50 / 1 M |
| MAU | 50 K | 100 K | $0.00325 / MAU |

> **Budget alert:** Set a Supabase billing alert at **80% of monthly budget** to receive email notification before hitting overages.

---

## 3. Monitoring Procedures

### 3.1 Daily Check (5 minutes)

Navigate to: **Supabase Dashboard → Project → Reports**

1. **Database → Query Performance**: Check for queries with `mean_exec_time > 100ms`. Investigate with `pg_stat_statements`.
2. **Database → Connections**: Verify active connections < 80.
3. **Stripe webhook** (canonical: Worker `POST /webhooks/stripe`): Verify error rate < 0.1%.
4. **Billing → Usage**: Verify egress/row reads are tracking below weekly projection.

```sql
-- Top slow queries (run in SQL Editor)
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 3.2 Weekly Review (15 minutes)

1. **Standings MV freshness**:
```sql
SELECT refreshed_at, count(*) as team_count
FROM public.mvw_standings
GROUP BY refreshed_at
ORDER BY refreshed_at DESC
LIMIT 1;
```
If `refreshed_at` is older than 24 hours and games have been played, manually refresh:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mvw_standings;
```

2. **RLS audit review**:
```sql
SELECT table_name, action, count(*), max(created_at)
FROM public.rls_audit
WHERE created_at > now() - interval '7 days'
GROUP BY table_name, action
ORDER BY count(*) DESC;
```
Any `policy_missing_warning` entries require immediate policy creation.

3. **Stripe events health**:
```sql
SELECT status, count(*), max(created_at)
FROM public.stripe_events
WHERE created_at > now() - interval '7 days'
GROUP BY status
ORDER BY count(*) DESC;
```
`failed` rows → investigate `error_detail`, consider manual replay.

4. **Import jobs failures**:
```sql
SELECT job_type, status, failed_rows, error_summary, created_at
FROM public.import_jobs
WHERE (status = 'completed_with_errors' OR failed_rows > 0)
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 20;
```

### 3.3 Monthly Review (30 minutes)

1. Check Supabase billing summary against budget.
2. Review `idx_usage` from `pg_stat_user_indexes` — drop unused indexes.
3. Run `VACUUM ANALYZE` on high-write tables if auto-vacuum stats show bloat:
```sql
SELECT schemaname, tablename, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```
4. Archive billing_events older than 6 months to a cold table if size > 2 GB.

---

## 4. TanStack Query Configuration Audit

The global QueryClient config in `src/App.tsx` is set as follows (audited 2026-04-04, no changes needed):

| Setting | Value | Rationale |
|---------|-------|-----------|
| `staleTime` | 30 000 ms | Prevents duplicate fetches on re-mount/re-focus |
| `gcTime` | 300 000 ms | Keeps cache entries for 5 min before GC |
| `retry` | 1 | Avoids hammering degraded backend |
| `retryDelay` | `min(1000 * 2^attempt, 30s)` | Exponential back-off |
| `refetchOnWindowFocus` | `false` | Prevents thundering herd on alt-tab during live games |

**Review trigger:** If row reads spike > 2× normal on a day without traffic growth, audit for components that override `staleTime: 0` or mount/unmount frequently.

---

## 5. Escalation Procedures

| Severity | Trigger | Response | Owner |
|----------|---------|----------|-------|
| P1 | DB connections > 150 or Realtime messages > 300/s | 15-min SLA — scale PgBouncer, investigate unbounded queries | Platform Eng |
| P2 | Slow queries > 5/min or Egress > 4 GB/day | 2-hr SLA — add missing index, review SELECT * patterns | Backend |
| P3 | Stripe webhook error rate > 1% | 4-hr SLA — check stripe_events.failed rows, Sentry alerts | Backend |
| P4 | RLS audit `policy_missing_warning` | 24-hr SLA — add policy or archive table | DBA |

---

## 6. Emergency Cost Controls

If monthly cost is projected to exceed budget by > 20%:

1. **Enable read replicas** for /api/teams and /api/scores if not already active.
2. **Increase CDN cache TTL** for public API responses via `wrangler.jsonc` Cache-Control header.
3. **Reduce Realtime publication scope** — remove `mvw_standings` from `supabase_realtime` if standings subscriptions are causing message spikes.
4. **Increase TanStack Query staleTime** on high-frequency pages (Live, Scores) from 30s to 120s.
5. **Enable PWA asset pre-caching** for top-50 player headshots in `workbox.runtimeCaching` to reduce Storage egress.

---

*Document owner: Platform Engineering. Review cycle: Quarterly or after any incident affecting Supabase costs.*
