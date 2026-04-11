<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# STREAM_RISK_MODEL

## High/Critical Risk Classes
1. Source leakage: raw upstream refs exposed to public clients.
2. Authz bypass: entitlement/session checks enforced client-side only.
3. One-device bypass: duplicate active sessions per entitlement.
4. Expiry bypass: six-hour entitlement overrun through reconnect/refresh.
5. Idempotency gaps: duplicate entitlement/session side effects.
6. Interaction abuse: comment/reaction storms destabilize playback.
7. Viewer counter inflation: duplicate tab/reconnect counts not deduped.
8. Secret leakage: artifacts/logs contain JWTs, tokens, raw URLs, unhashed IP.
9. Ambiguous source URLs: generic Facebook/profile links accepted without deterministic target.
10. Live-state drift: stream transitions live without a selected game.

## Defensive Controls
- Server-side authorization for access/comments/reactions.
- Transactional one-device enforcement.
- Short-lived signed playback artifact TTL.
- Sliding-window abuse controls.
- Audit logs for all sensitive actions.
- Source validator contract (`ok`, `normalizedUrl`, `sourceType`, `sourceStatus`, `riskLevel`, `visibilityClass`, `validationMessage`, `blockingReason`) enforced before Go Live.
- Public upstream warning surfaced to Ops (`visibilityClass=public` ⇒ soft paywall only).
- Artifact redaction scans in `validate:prelive`.

## Validation Mapping
Every risk class maps to a dedicated verdict key in `validation-report.json`.
Any unmapped or unproven risk is a release blocker.
