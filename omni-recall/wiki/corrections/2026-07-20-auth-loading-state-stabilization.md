# Correction: E2E Auth Loading State Reset & Playwright Selector Flakiness

- **Date:** 2026-07-20
- **Scope:** Project-wide
- **Affected Pages:** `CLAUDE.md`, `CHANGELOG.md`, `playwright.config.ts`, `src/contexts/AuthContext.tsx`
- **Promotion Decision:** User-pattern rule & core directive

## Original Assumptions vs. Corrected State

### 1. Supabase Auth State Change Listener Triggering Loading Resets
- **Original Assumption:** Firing `setLoading(true)` unconditionally on the `SIGNED_IN` event in the Supabase authentication state listener was safe because it ensures that profile and role claims are loaded before routing occurs.
- **Corrected State:** In Supabase Auth JS v2, background session verification and token refreshes periodically emit `SIGNED_IN` events. When this occurs on an already logged-in session, resetting the `loading` flag to `true` causes route guards like `RequireAdmin` or `RequireAuth` to return a fallback loading view, which temporarily unmounts the active page component. Under E2E test runs, this unmounting wipes React state (including uploaded image buffers and parsed text inputs) and causes random, intermittent failures.
- **Resolution:** Introduced a mutable `lastUserIdRef` in [AuthContext.tsx](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/src/contexts/AuthContext.tsx) to store the currently authenticated user's ID. When a `SIGNED_IN` event occurs, we verify if `lastUserIdRef.current` equals the new user ID. If they are equal (meaning it is a background session sync/refresh), we bypass setting `loading = true`, keeping the UI mounted and preserving local component state.

### 2. Flaky Playwright File Upload Triggers on Hidden Inputs
- **Original Assumption:** Calling `.setInputFiles()` directly on hidden inputs (e.g. `type="file" className="hidden"`) is a reliable way to upload files in E2E tests.
- **Corrected State:** Under high CPU load or parallel execution, triggering `.setInputFiles()` on hidden file inputs can fail because the element does not receive a stable focus or change event.
- **Resolution:** Refactored uploads in [ops-media-tabs.spec.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/e2e/ops-media-tabs.spec.ts) and [ops-auth-ingest-harmony.spec.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/e2e/ops-auth-ingest-harmony.spec.ts) to wait for the Playwright `'filechooser'` event, click the dropzone trigger element, and call `setFiles()` on the returned chooser.

### 3. Production-Targeting Diagnostic Specs Failing in CI
- **Original Assumption:** All `*.spec.ts` files under `/e2e` can be run in the default CI pipeline.
- **Corrected State:** Specs like `potg-vision-test.spec.ts` (which uploads hardcoded files using Windows local paths) and `check_iframe.spec.ts` (which tests the live `https://sbbl-hq.icu/live` page and times out waiting for `networkidle`) are diagnostic probes that target production environments and cannot execute deterministically in GitHub Actions CI containers.
- **Resolution:** Added `testIgnore: ['**/potg-vision-test.spec.ts', '**/check_iframe.spec.ts']` in [playwright.config.ts](file:///c:/Users/sinyo/sbbl-hq/sbbl-hq/playwright.config.ts) to prevent the CI runner from executing them during normal builds, while keeping them executable for local manual runs.
