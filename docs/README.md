# SBBL HQ Documentation Hub

**Documentation Version:** v1.0.0  
**Last Updated (UTC):** 2026-03-28

This directory contains the operational and engineering documentation set for SBBL HQ.

## Contents

1. [Build Audit Report](./quality/BUILD_AUDIT_2026-03-28_v1.0.0.md)
2. [Operations Runbook](./runbooks/OPERATIONS_RUNBOOK_v1.0.0.md)
3. [Developer Onboarding](./onboarding/DEVELOPER_ONBOARDING_v1.0.0.md)
4. [Debugging Protocol](./protocols/DEBUGGING_PROTOCOL_v1.0.0.md)
5. [Emergency Response Protocol](./protocols/EMERGENCY_RESPONSE_PROTOCOL_v1.0.0.md)
6. [Production Status](./status/PRODUCTION_STATUS_2026-03-28_v1.0.0.md)

## Documentation Governance

- **Versioning:** Semantic versioning for docs (`vMAJOR.MINOR.PATCH`).
- **Dating:** Use UTC calendar dates (`YYYY-MM-DD`) for all status and audit reports.
- **Ownership:** Engineering lead owns runbook/protocol updates; release manager owns production status updates.
- **Review cadence:**
  - Build audit: every release candidate or weekly (whichever comes first)
  - Production status: daily while incident/open risks exist; otherwise weekly
  - Onboarding docs: monthly

## Definition of "100/100" Quality State

A practical release-quality 100/100 state in this repository is defined as:

- Dependency install succeeds in CI and local dev.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass.
- No failing tests and no lint errors/warnings.
- Build artifacts generated deterministically.
- Remaining non-blocking risks documented with mitigation plans.

