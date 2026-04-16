## BOLT JOURNAL

## 2024-05-18 - [Missing useMemo for Expensive Transformations]
**Learning:** Found an instance in React components (like `Schedules.tsx`) where raw arrays coming from APIs or mock data were being processed (`reduce`, `map`, `filter`) on every single re-render. Since React re-renders can happen frequently due to URL query param changes or nested contexts updates, leaving transformations outside of `useMemo` can lead to degraded performance, particularly with larger data sets.
**Action:** Always wrap `filter()`, `reduce()`, and `map()` chains in `useMemo` when they are inside a React component's main rendering scope and do not need to be recomputed unless their dependencies change.

## 2024-05-18 - [Missing useMemo for Expensive Array Sorting]
**Learning:** Found an instance in React components (like `Teams.tsx`) where raw arrays coming from APIs or mock data were being processed (like `sort()` with mathematical divisions nested inside) directly inside the JSX render loop. This leads to `O(N log N)` work being performed on every re-render.
**Action:** Always wrap `filter()`, `reduce()`, and `map()` chains or `sort()` operations in `useMemo` when they are inside a React component's main rendering scope and do not need to be recomputed unless their dependencies change.
## 2024-04-09 - Supabase Migration column rename
**Learning:** `media_publications` table had its `created_at` column renamed to `sort_at` during the `20260407103137_media_publications.sql` migration, but the subsequent `20260407200000_ingest_pipeline.sql` migration was still referencing `created_at` in the `v_ingest_reconciliation` view definition, causing Supabase Preview CI failures with "ERROR: column mp.created_at does not exist (SQLSTATE 42703)".
**Action:** Always ensure that subsequent migrations are updated to reflect column renames or schema changes made in previous migrations.
## 2026-04-11 - [Missing useMemo for Top-Level Array Lookups]
**Learning:** Found an instance in `Leaderboards.tsx` where  was being executed inside a `.map()` render loop, which results in expensive O(N) recalculations on every render. The  array and `categories` are not state or props, so `[]` is used as the dependency array for `useMemo`, but to be fully future-proof they should be explicitly defined as dependencies.
**Action:** When pre-computing a lookup map using `useMemo` to prevent expensive O(N) operations inside a React render loop, always verify and include any outer variables (even module-level arrays or statics) in the dependency array to ensure robustness and avoid future stale closure bugs.
## 2026-04-11 - [Missing useMemo for Top-Level Array Lookups]
**Learning:** Found an instance in Leaderboards.tsx where .find() was being executed inside a .map() render loop, which results in expensive O(N) recalculations on every render. The teams array and categories are not state or props, so [] is used as the dependency array for useMemo, but to be fully future-proof they should be explicitly defined as dependencies.
**Action:** When pre-computing a lookup map using useMemo to prevent expensive O(N) operations inside a React render loop, always verify and include any outer variables (even module-level arrays or statics) in the dependency array to ensure robustness and avoid future stale closure bugs.
## 2024-05-18 - [O(N^2) Array Deduplication]\n**Learning:** Found an instance in React components (like `Media.tsx`) and the Cloudflare worker (`index.ts`) where arrays were being deduplicated using `.filter()` combined with `.findIndex()`. This results in O(N^2) complexity, leading to performance bottlenecks when processing large data sets.\n**Action:** Replace `array.filter((item, index, self) => self.findIndex(i => i.id === item.id) === index)` with an O(N) `Set` implementation tracking seen IDs.
## 2024-05-18 - Nested Loop Array Reductions In React
**Learning:** Found nested loops using `filter` during render (e.g., inside `.map` of a React component). This performs an O(N * M) operation where both arrays scale linearly, creating large performance overheads and memory allocations during render cycles. Another issue was outer-scope dependencies triggering `react-hooks/exhaustive-deps`.
**Action:** When working with nested maps/filters inside a render function, precalculate aggregates using `useMemo` into a dictionary or hash map, converting the nested O(N * M) into sequential O(N) + O(M) and O(1) lookups during render. Also, ensure you omit outer scope values like static `mockData` variables from `useMemo` dependency arrays as they won't trigger re-renders.
## 2026-04-16 - Consolidated Event Stream v1\n**Learning:** Addressed Phase 0 constraints safely setting up the idempotent ingestion pattern, Supabase migrations for strict RLS constraints aligned with existing identity policies.\n**Action:** Remember to consistently include strict 'idempotency-key' usage across all mutating edge routes.\n
## 2026-04-16 - Broadcast Intelligence MVP\n**Learning:** Safely implemented frontend Broadcast React components using strictly validated types and idempotency wrappers to mock real-time game events sync.\n**Action:** Remember to safely enforce  and  types rather than  to prevent ESLint build failures.\n
## 2026-04-16 - Broadcast Intelligence MVP
**Learning:** Safely implemented frontend Broadcast React components using strictly validated types and idempotency wrappers to mock real-time game events sync.
**Action:** Remember to safely enforce Record<string, unknown> and Error types rather than any to prevent ESLint build failures.

## 2026-04-16 - HoopsTok Social Feed MVP
**Learning:** Built snap-scrolling vertical video feed with robust component routing while navigating TypeScript `Record<string, unknown>` limits for arbitrary API payloads.
**Action:** Use `String(obj.property)` when rendering arbitrary record properties in React to ensure strict typing.

## 2026-04-16 - Hands-Free Sim Coach Mode
**Learning:** Integrated mocked SpeechRecognition with Supabase Realtime using idempotency for coach commands while enforcing strict typing rules around external browser APIs.
**Action:** Use `(window as Record<string, unknown>)` with `as any` isolated casting within generic constructors when interacting with non-standard DOM globals to satisfy strict TypeScript configs without resorting to full `any`.

## 2026-04-16 - Phase 4-6 Backend Completion
**Learning:** Safely implemented CV/RecSys edge handlers avoiding explicit database joins, instead using DO rooms and KV caching paradigms aligned with existing architecture.
**Action:** Remember to use `s-maxage` and `max-age` effectively on `GET` endpoints within Cloudflare Workers to bypass database hits for repetitive requests.

## 2026-04-16 - Vite Build Failures with Supabase
**Learning:** Found an instance in React components (like `BroadcastOverlay.tsx`, `SimCoachClient.tsx`, `OperatorTaggingUI.tsx`, and `HoopsTokFeed.tsx`) where `supabase` was directly imported from `@/lib/supabase/client` instead of using the `requireSupabaseClient` function, causing Vite build runtime errors.
**Action:** Always import `requireSupabaseClient` and invoke it to grab the client instance during component execution rather than relying on a top-level un-exported `supabase` variable when building components interacting with the API to prevent production build failures.
