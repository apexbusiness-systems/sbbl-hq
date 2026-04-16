# CHANGELOG

## 2026-04-16 - v1.0-store-canonicalization-hardening
- Standardized the database schema on `store_products`, `store_orders`, and `custom_quote_requests`.
- Implemented robust server-side webhook syncing for store orders.
- Removed mock data paths from UI and properly fetched via Edge Workers.
- Enforced strict IDEMPOTENCY KEY propagation.
- Canonicalized internal API data maps.
