# WS2–WS7 Release + Rollback Checklist

## Pre-release
- Confirm migration state up to latest revision.
- Verify env flags default OFF in production.
- Verify required secrets are populated (`PLAYBACK_TOKEN_SECRET`, Stripe, biometric webhook).

## Activation order
1. WS2 signed playback (single test game first).
2. WS3 viewer preflight.
3. WS4 fan tokens.
4. WS5 biometrics.
5. WS6 Mic Up Series.
6. WS7 replay.

## Observability
- Add Sentry metric alert: `stream.access.v2` error rate > 0.1% over 5m.
- Monitor webhook failure counts (Stripe + biometric).

## Rollback
- Toggle affected feature flags OFF.
- Keep webhook endpoints up long enough to drain retries.
- Revert only feature-specific UI mounts if persistent client-side regressions are observed.
