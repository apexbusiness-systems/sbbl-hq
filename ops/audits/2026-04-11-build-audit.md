# Build Audit — 2026-04-11

**Branch audited:** `main` @ `2ff5acf` ("feat: Apex/sbblhq/20260411 20k concurrent optimizations (#276)")
**Auditor:** Claude Code on branch `claude/audit-sbbl-hq-build-nEgtq`
**Node:** v22.22.2
**npm:** 10.9.7
**Package lockfile:** `package-lock.json` (1026 packages)

## Scope

Full CI-equivalent gate sweep of the sbbl-hq frontend + worker bundle to confirm the 20k-concurrent optimizations landed in PR #276 did not regress any build-time invariants. No source changes were made during this audit.

## Results

| Gate | Command | Status | Duration | Notes |
|---|---|---|---|---|
| Install | `npm ci` | PASS | 23s | Clean install from lockfile, 1026 packages |
| Typecheck | `npm run typecheck` | PASS | — | `tsc --noEmit` clean on `tsconfig.app.json` and `tsconfig.node.json` |
| Lint | `npm run lint` | PASS | — | ESLint (flat config, `eslint.config.js`) clean |
| Build | `npm run build` | PASS | 12.21s | Vite 5.4.19, 2495 modules transformed |
| PWA | (build-step) | PASS | — | Workbox `generateSW`, 68 precache entries, 1435.30 KiB precache |
| Unit tests | `npm test` | PASS | 23.58s | 53 files, **334 passed / 7 skipped** |

All gates green. Nothing to fix.

## Bundle analysis

Largest chunks (gzipped), post-build:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-BfOBbjJ8.js` | 337.05 KB | 109.49 KB |
| `ui-vendor-BX9A_MHy.js` | 257.28 KB | 81.33 KB |
| `supabase-vendor-IJ7xQdWp.js` | 193.65 KB | 50.93 KB |
| `react-vendor-Ca18Gtt0.js` | 164.39 KB | 53.47 KB |
| `Ops-DkBD2vbg.js` | 67.59 KB | 12.21 KB |
| `Live-CP-wxX3X.js` | 66.02 KB | 20.66 KB |
| `utils-vendor-BnwgJQDu.js` | 54.03 KB | 12.41 KB |
| `query-vendor-DzMdP7_F.js` | 39.19 KB | 11.69 KB |
| `SBBL-HQ-DX8LcRw3.mp3` | 3484.64 KB | — (precached binary) |

Observations:

- No Vite "chunks larger than 500 KB" warnings.
- Code-splitting working: `Live`, `Ops`, `Home`, `Teams`, `Schedules`, `Scores`, `Store`, `Profiles`, `Stats`, `Leaderboards`, `Media`, `Login`, `Onboarding`, `Settings`, `Billing`, `Support`, `TermsOfService`, `PrivacyPolicy`, `Offline`, and `NotFound` are each in their own lazy chunk.
- Manual vendor chunks (`react-vendor`, `ui-vendor`, `supabase-vendor`, `query-vendor`, `utils-vendor`) are splitting as configured in `vite.config.ts`.
- `src/assets/SBBL-HQ.mp3` is **3.4 MB** and enters the service worker precache. This is an intentional product decision (home-screen music), not a build defect — but it is by far the largest single precache entry and inflates install-time PWA bandwidth. Flagged for the product owner, not as a blocker.

## Test suite summary

- 53 test files, 334 tests passing, 7 skipped, 0 failing.
- Coverage spans: worker routes (`worker-routes`, `worker-public-contract`, `worker-coach-approval`, `worker-stripe-ppv`, `worker-auth`, `worker-ops-imports`), UI pages (`login-page`, `teams-page`, `home-hero-fallback`), domain logic (`stats-validator`, `omniport`, `idempotency`, `migration-smoke`, `ingest-auth-regression`), and worker safe routes.

## Non-blocking noise

Surfaced during the test run, **not action items for this audit** but worth noting:

1. **React Router v7 future-flag warnings** — `v7_startTransition`, `v7_relativeSplatPath`. Opt-in flags; no behavioral change until the v7 upgrade.
2. **`DEP0040` punycode deprecation** from jsdom transitive dep. Upstream; no local fix.
3. **npm 10 → 11 upgrade notice** on `npm ci`. Cosmetic.

## Conclusion

**Build is green and ready to ship.** The 20k-concurrent optimizations in #276 did not regress any build-time gates. No fixes were made on branch `claude/audit-sbbl-hq-build-nEgtq`; this document is the sole artifact.

---

*Generated on 2026-04-11 by a Claude Code audit run.*
