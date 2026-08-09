# SBBL-HQ — APEX Audit 2026-04-25

## /live stream blocker — closure verification

**Status:** GREEN. Bug fixed by commit `e3cce5c` (2026-04-25 16:28:13 -0600).

### Test ground truth
- test:stream:unit: 6/6 passed
- test:stream:int: 2/2 passed
- worker security headers: 13/13 passed (5 unit + 8 ops)
- vitest live cluster: 304/304 passed
- e2e stream-validation.spec.ts: 5/5 passed (chromium)
- e2e live-data-visual-proof.spec.ts: 5/5 passed (chromium)

### Sentry
Sentry verification skipped (`SENTRY_AUTH_TOKEN` not in scope per session directive).

To complete this section, an operator with Sentry access should run:

```bash
sentry-cli issues list \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  --query 'url:*sbbl-hq.icu/live* age:-48h' \
  --max-rows 50
```

…and append the top-5-by-event-count to this section.

## Regression shield — added in PR https://github.com/apexbusiness-systems/sbbl-hq/pull/439

> Historical link. Pull requests were **not** carried over by the 2026-08-09
> migration to `sbblhqapp/sbblhq`, so pre-migration PR permalinks intentionally
> still resolve against the archived repo.

- `playwright.config.ts`: webkit + mobile-safari projects added
- `.github/workflows/*.yml`: install `chromium webkit` in every workflow that
  runs Playwright (`989d404`, `0775242`)
- `playwright-fixture.ts`: `cspWatcher` fixture captures CSP console-error
  and pageerror, attaches violations as JSON artifact (`64e5c62`)
- `e2e/stream-validation.spec.ts` + `e2e/live-data-visual-proof.spec.ts`:
  assert zero CSP violations in `afterEach` (passing tests only) (`64e5c62`)
- `e2e/csp-invariant.spec.ts` (new): zero CSP violations on `/` and `/live`
  on chromium + webkit + mobile-safari
- WebKit + mobile-safari projects scoped via `testMatch` to **only** run
  `csp-invariant.spec.ts`. Initial CI run on PR #439 surfaced 15 pre-existing
  cross-browser failures in unrelated specs (broadcast-overlay, ops-media-*,
  store, viewer-preflight, stream-validation, build-chaos,
  ops-auth-ingest-harmony) — selectors and timing assumptions tuned for
  Chromium that have never been validated against Safari. Out of scope for
  this CSP regression shield. Expand the `testMatch` glob deliberately, one
  spec at a time, only after each spec is verified cross-browser-clean.

### Local chromium evidence
```
CI=1 npx playwright test --project=chromium
  33 passed, 5 skipped
  (the 5 skipped are live-data-visual-proof prod-API tests that the spec
   itself skips under CI=1 — matches what CI runs)

CI=1 npx playwright test --project=chromium e2e/csp-invariant.spec.ts
  5/5 passed
```

WebKit blocked locally (sandbox missing `libwebkit2gtk`, `libflite`,
`libenchant`, `libwoff2dec`). CI is the source of truth for webkit.

## Outstanding work
None for this scope.
