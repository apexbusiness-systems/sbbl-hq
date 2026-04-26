# SBBL-HQ — APEX Audit 2026-04-25

## /live stream blocker — closure verification

**Status:** GREEN. Bug fixed by commit `e3cce5c` (2026-04-25 16:28:13 -0600).
Five DevTools captures (2026-04-24 23:40 → 2026-04-25 14:19 MDT) predate the
fix by ~2h. Repo CSP at `src/worker/index.ts:6349-6366` is byte-exact with
production CSP served from `https://sbbl-hq.icu/live`.

### Test ground truth (run 2026-04-26T02:38Z, prior to this PR)
- `test:stream:unit`: 6/6 passed
- `test:stream:int`: 2/2 passed
- worker security headers: 13/13 passed (5 unit + 8 ops)
- vitest live cluster: 304/304 passed
- e2e `stream-validation.spec.ts`: 5/5 passed (chromium)
- e2e `live-data-visual-proof.spec.ts`: 5/5 passed (chromium)

### Production probe (chromium, 2026-04-26T02:38Z)
- HTTP 200, page renders empty-state ("No Active Broadcast") because
  `/ops/streams/config` returns `{ok:false, unauthorized}` for anon and
  `/api/public/home` reports no live game. Player gate at
  `src/pages/Live.tsx:1336` correctly does not instantiate Twitch in this
  branch. **This is working as designed.**
- CSP errors: 0 · Twitch errors: 0 · Autoplay errors: 0
- The single console error captured was sandbox-specific
  (`SSL certificate error occurred when fetching the script`) — not a real
  prod CSP violation.

### Sentry — last 48h, `url:*sbbl-hq.icu/live*`
**STUB — not executed in this session.** `SENTRY_AUTH_TOKEN` is not set in
the working environment. The Sentry pre-flight gate was explicitly skipped
per operator instruction. Real-user error verification for `/live` over the
last 48h remains **outstanding**.

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

- `playwright.config.ts`: webkit + mobile-safari projects (already in `0f82f61`,
  template-literal syntax repaired in `5d144fd`)
- `.github/workflows/playwright-e2e.yml` + `.github/workflows/ci.yml`:
  install webkit deps in CI (`989d404`)
- `playwright-fixture.ts`: `cspWatcher` fixture captures CSP console-error
  and pageerror, attaches violations as JSON artifact (`64e5c62`)
- `e2e/stream-validation.spec.ts` + `e2e/live-data-visual-proof.spec.ts`:
  assert zero CSP violations in `afterEach` (passing tests only) (`64e5c62`)
- `e2e/csp-invariant.spec.ts` (new): zero CSP violations on `/`, `/live`, and
  the three league-addressable routes `/league/{sbbl,wbl,tgifbl}` on both
  chromium and webkit projects (`d15a68e`)

### Adaptation note
The original spec called for `/live?league={wbl,tgif,spring}`. `/live` does
not parse `?league=` (uses internal `activeLeagueIdx` state — see
`src/pages/Live.tsx`). League-addressable URLs in this app are
`/league/:leagueId` (App.tsx:141), and league IDs are `sbbl`, `wbl`,
`tgifbl` (no `spring`). The invariant uses the real routes — same intent.

### Local chromium evidence (post-rebase, post-fix)
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
1. **Sentry verification** for `/live` real-user errors over last 48h —
   blocked on `SENTRY_AUTH_TOKEN` not being available in this session.
2. **CI confirmation on webkit** — PR #439 must show the webkit project
   green before merge.
3. Section §4 of the original prompt (repo-wide audit) remains
   out-of-scope until a fresh prompt is issued.
