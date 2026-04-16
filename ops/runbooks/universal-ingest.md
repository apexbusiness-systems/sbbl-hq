# OPS RUNBOOK: Universal Stream Ingest

## 1. Overview
The Universal Stream Ingest ensures that operators can proceed with streaming links regardless of confidence, URL format, or platform constraints (such as Facebook or unrecognized schemes). The backend gracefully handles untrusted protocols and unrecognized links to avoid preventing stream publishing.

## 2. Ingest Architecture
- **No Pre-Live Blockers:** The Cloudflare worker (`validate-stream-url.ts`) and ingest logic (`handleUpdateStreamConfig` & `handleGoLive`) have had restrictive gates removed.
- **Permissive Flow:** All provided URL strings are automatically parsed. If the URL uses unparseable schemas, it skips `new URL()` validation and passes verbatim. Unsafe schemas (`javascript:`, `vbscript:`, etc) are replaced securely while the operator encounters **zero frontend rejection blocks**.

## 3. UI and Monitoring
1. In the Broadcast Controls (`Live.tsx`), the operator enters a URL.
2. No validation popups will appear except advisory text regarding the protocol parsed via `url-detector.ts`.
3. Operator can securely start streaming without `Stream URL is invalid` or similar error flags rejecting the save action.

## 4. Fallback Handling
If a link causes an unplayable stream (e.g. facebook.com stream limitations),
1. The `ReactPlayer` wrapper will present a standardized "Stream Unavailable" display to users.
2. Operators will see real-time player errors on the admin stream preview.
3. The operator can use the same UI to seamlessly patch a new unblocked URL and `Save` without resetting the livestream layout.
