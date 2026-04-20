## 2026-04-16 - Store Architecture Hardening
**Learning:** Migrating from ad-hoc JSON carts to explicit structured tables like `store_orders` and `custom_quote_requests` simplifies Worker webhook handling.
**Action:** Ensure that new commerce features build against the canonical `store_*` namespace directly to preserve idempotency and referential integrity.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability () to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability (`insert([...items])`) to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.

## 2025-05-15 - Array Spread and Loop Optimizations
**Learning:** Using array spread syntax `[...a, ...b].find(...)` inside `useMemo` or handlers causes unnecessary memory allocations and O(N) overhead on every interaction, even if the result is memoized. Furthermore, using `.find()` inside a loop (like `.reduce()`) creates an O(N*M) bottleneck.
**Action:** Search arrays sequentially using logical OR (`a.find(...) || b.find(...)`) to avoid spread allocations. Always use pre-computed dictionaries (like `Record<string, Product>`) for O(1) lookups inside rendering or handler loops.
