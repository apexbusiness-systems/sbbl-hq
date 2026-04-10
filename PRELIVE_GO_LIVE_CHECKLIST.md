<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# PRELIVE_GO_LIVE_CHECKLIST

## Hard Gates
- `npm run build` passes
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run test:stream:all` passes
- `npm run validate:prelive` returns `VERIFIED`

## Security Gates
- Validation controls disabled by default in production
- Validation controls execute only when `ENABLE_STREAM_VALIDATION=true` and caller is `super_admin`
- No secret leakage in emitted artifacts/logs

## Stream Gates
- Ingest evidence present
- Playback media proof present
- Paywall proof present
- One-device proof present
- Resume proof present
- Expiry proof present
- Comment/reaction broadcast proof present
- Viewer counter proof present
- Abuse/rate-limit proof present

## Artifacts Required
- `validation-report.json`
- `verification-matrix.md`
- `performance-summary.json`
- `audit-summary.json`
- Playwright traces/screenshots (when failures occur)

## Decision
- All gates green: `VERIFIED`
- Any missing evidence: `REJECTED`
