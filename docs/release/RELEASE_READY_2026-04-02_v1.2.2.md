# SBBL-HQ Release Readiness Report

- **Document ID:** RELEASE_READY_2026-04-02_v1.2.2
- **Date (UTC):** 2026-04-02
- **Version:** v1.2.2
- **Prepared by:** Codex delivery pass
- **Current verdict:** **NOT READY**

## Delta from v1.2.1
- Supabase project linking succeeded for project ref `ezanilxygnpucwkwpsoc`.
- Fresh DB migration attempt now fails at DB connectivity/password stage, not auth/project-ref stage.

## Critical Command Evidence
- `npx supabase link --project-ref ezanilxygnpucwkwpsoc` → `Finished supabase link.`
- `npx supabase db push` / `npm run db:migrate` →
  - repeated retries to connect `aws-0-us-west-2.pooler.supabase.com:5432`
  - `connect: network is unreachable`
  - final CLI guidance: `Connect to your database by setting the env var correctly: SUPABASE_DB_PASSWORD`

## Verification Matrix (Current)

| Gate | Status | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| build | PASS | `npm run build` |
| unit/integration tests | PASS | `npm run test` (24 files / 78 tests) |
| e2e | PASS | `npx playwright test` (8/8) |
| Supabase project link | PASS | `supabase link` success |
| fresh DB migration | BLOCKED | DB pooler connectivity/password (`SUPABASE_DB_PASSWORD`) |
| deploy smoke (Supabase/Stripe/Vercel) | BLOCKED | credentials/bindings unavailable |

## Final Decision
- **Release status:** **NOT READY**
- **Reason:** migration and deploy integration gates remain unproven.

## Required Inputs to Proceed
1. `SUPABASE_DB_PASSWORD` for linked project DB push.
2. Network path permitting outbound TCP to Supabase pooler endpoint.
3. Deploy credentials/bindings for integration smoke (Supabase/Stripe/Vercel).
