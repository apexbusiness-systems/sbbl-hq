# BIOMETRIC_OVERLAY v1.0.0

## Scope
- `BiometricDualOverlay` mounted in live player container.
- `BiometricAdminPanel` hosted at `/ops/biometrics`.
- Wearable webhook ingress at `POST /api/streams/:gameId/biometrics/webhook`.

## Flags
- Worker: `FEATURE_BIOMETRIC_OVERLAY=true`
- Client: `VITE_FEATURE_BIOMETRIC_OVERLAY=true`

## Security
- Admin ingest requires verified user + admin role.
- Webhook ingest requires `x-sbbl-biometric-secret` == `BIOMETRIC_WEBHOOK_SECRET`.
- All writes constrained by table RLS.

## Rollback
- Disable both flags.
- Rotate `BIOMETRIC_WEBHOOK_SECRET`.
