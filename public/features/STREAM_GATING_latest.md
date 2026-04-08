<!-- Version: v1.4.2 | Date: 2026-04-07 | Status: Current -->
# Stream Gating

**Version:** v1.4.2  
**Last Updated:** 2026-04-07  
**Supersedes:** v1.4.1

## Current Gates

- Entitlement checks: `can_user_view_stream(game_id, user_id)`
- Session lifecycle: `active -> displaced -> ended`
- One-device enforcement and heartbeat-based extension
- 6-hour hard session cap

## Hardening Addendum (2026-04-07)

- Worker runtime now explicitly rejects publishable/anon key misuse as service-role key (`supabase_service_key_invalid`).
- This prevents silent partial failures where routes are matched but database/storage writes fail due wrong key class.
- Route-wiring coverage remains unchanged (90-route registry baseline remains valid).

## Validation Reference

- Hardening QA matrix: `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.2.0.md`
- Full route checklist baseline: `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`
- Test evidence: `docs/quality/evidence/hardening_tests_2026-04-07.log`
