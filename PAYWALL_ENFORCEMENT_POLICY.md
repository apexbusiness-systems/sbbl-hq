<!-- Version: v1.0.0 | Date: 2026-04-10 | Status: Current -->
# PAYWALL_ENFORCEMENT_POLICY

## Policy
1. Public upstream sources are soft-paywall only and must display risk warning.
2. Private/unlisted/protected upstream sources are hard-paywall eligible.
3. Access decisions are server-authoritative and never client-authoritative.
4. Entitled playback responses containing sensitive material must send no-store/no-cache.
5. Signed playback artifacts must be short-lived and never outlive entitlement expiry.

## Enforcement Requirements
- Every mutation uses `idempotency_key`.
- Every grant/deny/revoke/expire action writes audit trail rows.
- Unpaid, revoked, or expired viewers are denied playback.
- Public payloads never expose raw upstream source refs.

## Validation Contract
`validate:prelive` gates on:
- `paywall_verdict`
- `playback_verdict`
- `auditability_verdict`
