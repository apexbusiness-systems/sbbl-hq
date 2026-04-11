<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# STREAM_VALIDATION_MATRIX

This document defines the gating dimensions emitted by `validate:prelive`.

| Check | Evidence Source | Pass Rule |
|---|---|---|
| Stream Ingest Proof | integration phase + report | deterministic success evidence present |
| Live Playback Proof | e2e `[evidence:playback]` | media proof has >=4 valid signals |
| Paywall Gate Proof | e2e `[evidence:paywall]` | gated viewer cannot access playable media |
| One-Device Enforcement Proof | unit policy tests | different device/IP denied/challenged |
| Resume/Reconnect Proof | unit+integration | same-device+same-IP resume allowed |
| Expiry Proof | unit policy tests | six-hour entitlement hard-stop enforced |
| Idempotency Proof | unit+integration | replay attempts deterministic/no duplicate side-effects |
| Auditability Proof | gate artifact scan | no sensitive leakage in outputs |
| Live Comment Broadcast Proof | e2e/integration evidence tag | comments accepted only for valid sessions |
| Emoji/Reaction Broadcast Proof | e2e/integration evidence tag | reactions propagate within policy |
| Admin Viewer Counter Proof | integration evidence tag | active entitled sessions are deduped |
| Comment Rate Limit Proof | unit+integration | over-limit rejected deterministically |
| Interaction Layer Stability Proof | e2e + perf | interaction abuse does not collapse playback |
| Source Validator Contract Proof | unit + integration | output model fields present and deterministic per URL class |
| Facebook Deterministic URL Proof | unit + integration | slug `/live` rewrite accepted; `profile.php?id=` rejected |
| Live Toggle Game Binding Proof | integration | `isLive=true` rejected without `gameId` |
| Public Upstream Risk Proof | unit + ops UI check | `visibilityClass=public` surfaces soft-paywall warning |

## Final Verdict
- `VERIFIED`: every check is `VERIFIED`
- `REJECTED`: any check is `REJECTED`
