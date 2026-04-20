## 2026-04-16 - Store Architecture Hardening
**Learning:** Migrating from ad-hoc JSON carts to explicit structured tables like `store_orders` and `custom_quote_requests` simplifies Worker webhook handling.
**Action:** Ensure that new commerce features build against the canonical `store_*` namespace directly to preserve idempotency and referential integrity.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability () to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.

## 2025-05-14 - [Performance] Optimized Ops Batch Product Insertion
**Learning:** Sequential database inserts in a loop (N+1 query pattern) in Cloudflare Workers significantly increase latency due to multiple round-trips to the database.
**Action:** Use Supabase's native batch insert capability (`insert([...items])`) to perform multiple insertions in a single database call, reducing I/O overhead and improving response times.
## 2026-04-20 - [Chunked Base64 String Encoding]
**Learning:** String concatenation inside a loop over a large Uint8Array creates excessive intermediate allocations and severe CPU/Memory pressure in V8/Cloudflare Workers.
**Action:** Use chunked processing using `String.fromCharCode.apply` with a safe chunk size (e.g. 8192) to vastly minimize intermediate strings and speed up large buffer-to-string operations (~45% speedup on large arrays).
## 2026-04-20 - [Typechecking]
**Learning:** Be careful with type coercion like `as any` and renaming variables like `streamUrl` without verifying all places where the variable was referenced.
**Action:** Always run `npm run typecheck` before committing to avoid breaking the CI.
## 2026-04-20 - [Fixing Vitest OOM]
**Learning:** Using `istanbul` for coverage in large React/JSDOM test suites will store the entire AST in memory and consume >8GB of heap, crashing Github Actions runners.
**Action:** Replace `@vitest/coverage-istanbul` with `@vitest/coverage-v8` and configure `provider: "v8"` in `vitest.config.ts`.
