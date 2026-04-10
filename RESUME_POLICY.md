<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# RESUME_POLICY

## Resume Conditions
Resume is allowed only when:
- entitlement has not expired,
- existing session status is `active` or `resumable`,
- same-device + same-IP fingerprint matches.

## Heartbeat + Reclaim
- Server heartbeat tracks active sessions.
- Stale sessions may become reclaimable for same-device+same-IP only.
- Different-device reclaim is denied unless explicit challenge/takeover flow is enabled.

## Expiry Safety
- Reconnect grace must not outlive entitlement expiry.
- Session refresh cannot extend unauthorized viewing beyond entitlement.

## Validation Rule
Missing resume evidence or stale-session reclaim safety results in `resume_verdict = REJECTED`.
