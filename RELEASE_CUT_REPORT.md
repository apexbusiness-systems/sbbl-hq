# Release Cut Convergence Report (Repair Branch → PR #20)

## Canonical league identity contract
- `SBBL` — `Sunday’s Best Basketball League`
- `WBL` — `Weekend Basketball League`
- `TGIFBL` — `Thank God It’s Friday Basketball League`

## Final league selector contract
- League selector is rendered as an accessible `tablist` with label **League selector**.
- Each league control is rendered as a `tab` and exposes a stable test id:
  - `data-testid="league-tab-sbbl"`
  - `data-testid="league-tab-wbl"`
  - `data-testid="league-tab-tgifbl"`
- Visible labels are canonical business abbreviations:
  - `SBBL`, `WBL`, `TGIFBL`
- No display exception is used in this release cut (`TGIFBL` remains visible as-is).

## Final public E2E contract
Critical-path Playwright now validates only intentional release-cut public surface:
1. `/` renders and header is visible.
2. League selector/tablist and all three canonical league tabs are visible.
3. Primary nav exposes only: `Home`, `Teams`, `Schedules`.
4. Home hero CTA labels are `Live Now` and `View Teams`.
5. `/teams` heading renders.
6. `/schedules` heading renders.
7. `/login` heading renders.

## Repair branch fixes before fold-back
- Removed stale critical-path assumptions tied to mock-era routes/labels.
- Hardened league selector with semantic tabs + stable test ids.
- Narrowed top-level primary nav to release-cut routes.
- Aligned hero CTA labels to release-cut contract.

## Handoff for PR #20 (canonical merge vehicle)
Cherry-pick these commits from repair branch into PR #20 branch:
1. `fd696a4` — Playwright decouple + initial critical-path/CI alignment.
2. `1a417e3` — release-cut UI contract enforcement + deterministic critical-path suite.
3. `HEAD` (this fix) — convergence documentation cleanup and explicit PR #20-only fold-back guidance.

### Conflict risk
- **Low/Moderate** in:
  - `src/components/layout/Header.tsx`
  - `src/pages/Home.tsx`
  - `e2e/critical-paths.spec.ts`
- If PR #20 touched these files after divergence, resolve by keeping this release-cut contract.

## Canonical release path confirmation
After cherry-picking the above commits, **PR #20 remains the only merge vehicle to `main`**.
