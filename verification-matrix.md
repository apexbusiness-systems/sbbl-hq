# Stream Validation Matrix

- validation_run_id: vrun_1775793423691_68f5a86b
- generated_at: 2026-04-10T03:57:54.918Z

| Check | Verdict |
|---|---|
| Scope Alignment | VERIFIED |
| Hallucination Scan | VERIFIED |
| Ghost Feature Detection | VERIFIED |
| TODO / Stub Audit | VERIFIED |
| Test Coverage | REJECTED |
| Stream Ingest Proof | VERIFIED |
| Live Playback Proof | REJECTED |
| Paywall Gate Proof | REJECTED |
| One-Device Enforcement Proof | VERIFIED |
| Resume / Reconnect Proof | VERIFIED |
| Expiry Proof | VERIFIED |
| Idempotency Proof | VERIFIED |
| Auditability Proof | VERIFIED |
| Live Comment Broadcast Proof | REJECTED |
| Emoji / Reaction Broadcast Proof | REJECTED |
| Admin Viewer Counter Proof | REJECTED |
| Comment Rate Limit Proof | VERIFIED |
| Interaction Layer Stability Proof | VERIFIED |
| Final Verdict | REJECTED |

## Failing Checks
- playback_verdict
- paywall_verdict
- comments_verdict
- reactions_verdict
- viewer_counter_verdict

## Remediation
- Resolve playback_verdict and rerun: npm run validate:prelive
- Resolve paywall_verdict and rerun: npm run validate:prelive
- Resolve comments_verdict and rerun: npm run validate:prelive
- Resolve reactions_verdict and rerun: npm run validate:prelive
- Resolve viewer_counter_verdict and rerun: npm run validate:prelive
