## 2026-05-22 - [React Rendering & Memory Optimization]
**Learning:** In components like `BagDrawer` with conditional UI based on context (like `bagOpen`), keeping heavy React hooks (`useQuery`, `useMemo` for reductions) in the main component forces them to execute on every mount or background dependency update even when the drawer is closed.
**Action:** Extract expensive hook-heavy logic into an inner component (e.g., `BagDrawerContent`) that is conditionally rendered. This adheres to the Rules of Hooks while ensuring that the cost of rendering is zero when the drawer is inactive.
## 2026-05-22 - [React Rendering & Memory Optimization]
**Learning:** In components like `BagDrawer` with conditional UI based on context (like `bagOpen`), keeping heavy React hooks (`useQuery`, `useMemo` for reductions) in the main component forces them to execute on every mount or background dependency update even when the drawer is closed.
**Action:** Extract expensive hook-heavy logic into an inner component (e.g., `BagDrawerContent`) that is conditionally rendered. This adheres to the Rules of Hooks while ensuring that the cost of rendering is zero when the drawer is inactive.
