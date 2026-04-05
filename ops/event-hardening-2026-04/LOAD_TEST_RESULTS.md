# Load Test Results — Event Hardening 2026-04

## Environment

- **Target**: [staging/production URL]
- **Self-hosted Supabase**: [URL]
- **Test date**: [YYYY-MM-DD]
- **k6 version**: [version]
- **Test script**: `ops/event-hardening-2026-04/scripts/load-test.js`
- **Server specs**: [CPU/RAM/disk of self-hosted server]

---

## 5k VU Profile Results

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| /live p95 | <500ms | | |
| /live p99 | <1500ms | | |
| /live 5xx rate | <0.5% | | |
| auth p95 | <600ms | | |
| auth p99 | <1200ms | | |
| auth errors | <1% | | |
| checkout p95 | <800ms | | |
| checkout p99 | <2000ms | | |
| checkout 5xx | <0.5% | | |
| webhook 2xx rate | >99.9% | | |

---

## 20k VU Profile Results

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| /live p95 | <500ms | | |
| /live p99 | <1500ms | | |
| /live 5xx rate | <0.5% | | |
| auth p95 | <600ms | | |
| auth p99 | <1200ms | | |
| auth errors | <1% | | |
| checkout p95 | <800ms | | |
| checkout p99 | <2000ms | | |
| checkout 5xx | <0.5% | | |
| webhook 2xx rate | >99.9% | | |

---

## 50k VU Profile Results

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| /live p95 | <500ms | | |
| /live p99 | <1500ms | | |
| /live 5xx rate | <0.5% | | |
| auth p95 | <600ms | | |
| auth p99 | <1200ms | | |
| auth errors | <1% | | |
| checkout p95 | <800ms | | |
| checkout p99 | <2000ms | | |
| checkout 5xx | <0.5% | | |
| webhook 2xx rate | >99.9% | | |

---

## Infrastructure Metrics During Test

| Metric | 5k | 20k | 50k |
|--------|------|------|------|
| Postgres CPU % | | | |
| Postgres memory MB | | | |
| Postgres connections | | | |
| PgBouncer active | | | |
| PgBouncer waiting | | | |
| Worker CPU ms | | | |
| Worker memory MB | | | |
| Caddy requests/sec | | | |
| Caddy 5xx count | | | |
| Disk I/O (MB/s) | | | |

---

## Bottlenecks Found

- [ ] (describe bottleneck, e.g., "PgBouncer pool exhausted at 20k VUs")

---

## Mitigations Applied

- [ ] (describe mitigation, e.g., "Increased PgBouncer pool_size from 20 to 50")

---

## Conclusion

- [ ] 5k profile: PASS / FAIL
- [ ] 20k profile: PASS / FAIL
- [ ] 50k profile: PASS / FAIL

**Ready for cutover**: YES / NO

**Signed off by**: [name] on [date]
