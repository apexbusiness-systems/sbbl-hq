## BOLT JOURNAL

## 2024-05-18 - [Missing useMemo for Expensive Transformations]
**Learning:** Found an instance in React components (like `Schedules.tsx`) where raw arrays coming from APIs or mock data were being processed (`reduce`, `map`, `filter`) on every single re-render. Since React re-renders can happen frequently due to URL query param changes or nested contexts updates, leaving transformations outside of `useMemo` can lead to degraded performance, particularly with larger data sets.
**Action:** Always wrap `filter()`, `reduce()`, and `map()` chains in `useMemo` when they are inside a React component's main rendering scope and do not need to be recomputed unless their dependencies change.
