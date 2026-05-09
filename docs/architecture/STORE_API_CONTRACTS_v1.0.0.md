<!-- Version: v1.0.0 | Date: 2026-04-16 | Status: Current -->
# Store API Contracts

**Version:** v1.0.0 (store-canonicalization-hardening)
**Last Updated:** 2026-04-16
**Owner:** APEX Business Systems Ltd. — Engineering Lead

## `GET /api/public/products`
Returns a catalog of active products from `store_products`. Heavily cached on Cloudflare.

## `POST /api/store/checkout`
Creates a Stripe checkout session for items in a user's bag. Initializes a `store_orders` record with a `pending` state. Requires an idempotency key.

## `POST /api/store/quotes`
Submits a custom quote request into `custom_quote_requests`. Requires authentication and an idempotency key.
