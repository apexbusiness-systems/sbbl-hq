# Store Architecture

## v1.0-store-canonicalization-hardening
*Last Updated: 2026-04-16*

### Database Schema
The store canonicalizes around the following tables:
- `store_products`: The source of truth for items. Uses `price_cents` for financial precision.
- `store_orders`: Top-level order tracking.
- `store_order_items`: Line-item breakdown.
- `custom_quote_requests`: Stores bespoke gear requests that require offline quotation.

### API Routes
- `GET /api/public/products`: Returns active products from `store_products` with prices mapped from cents to dollars for frontend compatibility.
- `POST /api/store/checkout`: Converts frontend product IDs directly against `store_products`, generates a pending `store_orders` record, provisions `store_order_items`, and emits a Stripe checkout URL.
- `POST /api/store/quote`: Generates a `custom_quote_requests` entry.

### Stripe Webhook
- Re-uses `process_stripe_webhook` and updates `mark_order_paid` to interact directly with `store_orders`.
