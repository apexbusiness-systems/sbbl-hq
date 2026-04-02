# SBBL-HQ Release Readiness Report

- **Document ID:** RELEASE_READY_2026-04-02_v1.2.1
- **Date (UTC):** 2026-04-02
- **Version:** v1.2.1
- **Prepared by:** Codex delivery pass
- **Current verdict:** **NOT READY**

## Delta from v1.2.0
- Attempted Supabase project linking using provided project ref (`ezanilxygnpucwkwpsoc`).
- CLI now returns explicit auth blocker: access token missing.

## Critical Command Evidence
- `npx supabase link --project-ref ezanilxygnpucwkwpsoc` →
  `Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.`
- `npm run db:migrate` still blocked until Supabase auth + project link is established.

## Verification Matrix (Current)

| Gate | Status | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| build | PASS | `npm run build` |
| unit/integration tests | PASS | `npm run test` (24 files / 78 tests) |
| e2e | PASS | `npx playwright test` (8/8) |
| project link/auth | BLOCKED | missing `SUPABASE_ACCESS_TOKEN` |
| fresh DB migration | BLOCKED | requires linked project |
| deploy smoke (Supabase/Stripe/Vercel) | BLOCKED | credentials/bindings unavailable |

## Final Decision
- **Release status:** **NOT READY**
- **Reason:** remaining ship-gate evidence depends on authenticated Supabase linkage and deploy credentials.

## Required Inputs to Proceed
1. `SUPABASE_ACCESS_TOKEN` (or completed `supabase login` context).
2. Confirm target Supabase project ref to link.
3. Deploy credentials/bindings for integration smoke (Supabase/Stripe/Vercel).
