<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# ONE_DEVICE_POLICY

## Default Enforcement
- One active playback access session per entitlement.
- Same device + same IP may resume inside entitlement window.
- Different device token or different IP is denied by default.
- Optional takeover flow may challenge, never silently replace.

## Fingerprint Inputs
- `device_token_hash`
- `installation_key_hash` (when available)
- `user_agent_hash`
- `ip_hash`

## Invariant
A resume is valid only if all are true:
1. entitlement is active
2. existing session is resumable
3. same-device check passes
4. same-IP check passes

## Validation Rule
Any violation of one-device invariants causes `one_device_verdict = REJECTED`.
