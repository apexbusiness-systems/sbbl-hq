# Replay Monetization Runbook

1. Wait until game status is `final` and embargo window has elapsed.
2. Set `games.replay_monetization_enabled_at = now()` for the game.
3. Verify `GET /api/streams/:gameId/replay/status` returns `enabled=true`.
4. Validate entitlement creation from replay webhook for one test purchase.
5. Monitor Sentry/worker logs for replay status and entitlement write failures.

## Rollback
- Set `replay_monetization_enabled_at = null` for impacted game(s).
- Revoke/reconcile replay entitlements if required.
