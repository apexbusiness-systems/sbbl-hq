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

## 2024-05-18 - [Optimize Nested Lookups During Render in React Mappings]
**Learning:** O(N) array traversals (like `.find()`) inside `.map()` rendering loops result in expensive O(N*M) time complexity. In dynamic components like `Leaderboards.tsx` or `Profiles.tsx`, this can severely lag the main thread on every re-render.
**Action:** Always extract O(N) mapping operations into an O(1) Dictionary/Map lookup pre-computed using `useMemo` before returning the rendered list to keep renders fast and main thread unblocked.
