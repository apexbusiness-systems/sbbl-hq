# Store Architecture v1.0
Date: 2026-04-16
Version: v1.0-store-canonicalization-hardening

## Overview
The Store module is designed as an edge-native commerce engine built on Cloudflare Workers and Stripe, backed by Supabase.

## Canonical Schema
The system uses `store_products`, `store_orders`, `store_order_items`, and `custom_quote_requests` as the single source of truth.

## Purchase Types
- **Direct Store Purchases**: Pushed through `store_orders` and fulfilled via Stripe sessions.
- **Custom Quotes**: Captured via `custom_quote_requests` for bespoke offline invoicing.

## Auditing
Both custom quote requests and store orders are heavily audited in `custom_quote_audit` and `store_order_audit` to ensure all state changes are explicitly captured.
