## BOLT JOURNAL

## 2024-05-18 - [Missing useMemo for Expensive Transformations]
**Learning:** Found an instance in React components (like `Schedules.tsx`) where raw arrays coming from APIs or mock data were being processed (`reduce`, `map`, `filter`) on every single re-render. Since React re-renders can happen frequently due to URL query param changes or nested contexts updates, leaving transformations outside of `useMemo` can lead to degraded performance, particularly with larger data sets.
**Action:** Always wrap `filter()`, `reduce()`, and `map()` chains in `useMemo` when they are inside a React component's main rendering scope and do not need to be recomputed unless their dependencies change.

## 2024-05-18 - [Missing useMemo for Expensive Array Sorting]
**Learning:** Found an instance in React components (like `Teams.tsx`) where raw arrays coming from APIs or mock data were being processed (like `sort()` with mathematical divisions nested inside) directly inside the JSX render loop. This leads to `O(N log N)` work being performed on every re-render.
**Action:** Always wrap `filter()`, `reduce()`, and `map()` chains or `sort()` operations in `useMemo` when they are inside a React component's main rendering scope and do not need to be recomputed unless their dependencies change.
