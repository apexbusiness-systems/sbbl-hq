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
