## 2026-04-16 - Store Architecture Hardening
**Learning:** Migrating from ad-hoc JSON carts to explicit structured tables like `store_orders` and `custom_quote_requests` simplifies Worker webhook handling.
**Action:** Ensure that new commerce features build against the canonical `store_*` namespace directly to preserve idempotency and referential integrity.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability () to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability (`insert([...items])`) to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.

## 2025-05-14 - [Performance] Optimized Store Checkout Loop
**Learning:** During array `.reduce()` operations in React components (like cart or checkout totals), using `.find()` inside the reducer creates an unexpected $O(N^2)$ algorithmic bottleneck, particularly when de-duplicating items by properties like `name` or `id`.
**Action:** Always replace nested `.find()` operations inside a `.reduce()` loop with an intermediate accumulator of type `Record<string, T>` to enable $O(1)$ property-based dictionary lookups.
