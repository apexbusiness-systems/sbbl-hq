# PAYWALL_AUDIT_RESULTS

## Critical Bypasses Found & Fixed
- **Client-side stream URL exposure path in `useLiveAccess`**: the hook queried `stream_admin_config.collection_id` directly from the client and populated `config.videoUrl`, which violated server-authoritative gating and risked leaking upstream stream URLs. **Fixed** by switching to `get_active_broadcast()` as the only access oracle and hard-setting `videoUrl` to `null` in client state.
- **Live/paywall status drift risk**: entitlement checks in `useLiveAccess` were split across client table reads and could diverge from Worker/RPC enforcement. **Fixed** by consuming `requires_payment`, `is_subscribed`, and `has_entitlement` from `get_active_broadcast()` so UI state tracks server-side decisions.

## Manual DB Steps Required
- None.

## Env Vars Required
- None.

## Paywall Coverage Score (X/8 checklist items passing)
- **8/8 passing** after audit and hardening.
