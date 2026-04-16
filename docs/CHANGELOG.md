# CHANGELOG

## 2026-04-16 - v1.0-store-canonicalization-hardening
- **Hardening**: Created migration to target `store_orders` in webhook and added audit triggers.
- **Worker API**: Refactored public products to fetch from `store_products`.
- **Worker API**: Added `/api/store/quote` for inserting into `custom_quote_requests` with idempotency.
- **Worker API**: Refactored `/api/store/checkout` to use `store_products` and create pending `store_orders`.
- **Worker API**: Updated Stripe webhook to no longer rely on legacy `orders` and `carts` tables for closing carts.
- **UI**: Connected `Store.tsx` to live product APIs and custom quote submission.
- **UI**: Refactored `BagDrawer.tsx` to pull from API data and submit accurate line item `price_cents`.
- **E2E**: Added tests for store browsing, bag additions, and idempotent custom quote request.
