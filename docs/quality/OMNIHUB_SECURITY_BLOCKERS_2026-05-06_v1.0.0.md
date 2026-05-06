<!-- Version: v1.0.0 | Date: 2026-05-06 | Status: Current -->
# OmniHub Security Blockers — Phase 0 → Phase 1 Gate

## Gate decision

**Status:** BLOCKED — no public demo, proof site launch, or enterprise sales conversation may start until the open APEX-OmniHub security PRs below are merged, validated, and the duplicate RLS PR is closed.

This gate is intentionally external to SBBL HQ application readiness: SBBL HQ can pass its own build/test/release checks and still remain blocked if OmniHub carries unresolved critical or high security debt.

## Source-of-truth PR queue

| Merge order | PR | Severity | Blocker | Required action |
|---:|---|---|---|---|
| 1 | [apexbusiness-systems/APEX-OmniHub#1060](https://github.com/apexbusiness-systems/APEX-OmniHub/pull/1060) | CRITICAL | `man_tasks` `operator_role` RLS policies used `USING (true)`, allowing cross-operator/cross-tenant MAN Mode approval queue read/write exposure. | Merge #1060 first; it preserves `service_role` full access while tightening `operator_role` visibility and update checks. |
| 1a | [apexbusiness-systems/APEX-OmniHub#1058](https://github.com/apexbusiness-systems/APEX-OmniHub/pull/1058) | HIGH | Alternate Codex-generated `man_tasks` RLS fix conflicts with #1060 and should not land after #1060 without re-review. | Close #1058 after #1060 is merged, or explicitly rebase/re-audit if #1060 is rejected. |
| 2 | [apexbusiness-systems/APEX-OmniHub#1061](https://github.com/apexbusiness-systems/APEX-OmniHub/pull/1061) | CRITICAL + HIGH | CVE-2026-41242 (`protobufjs` RCE, CVSS 9.4–9.8) and CVE-2025-62718 (`axios` SSRF) via transitive Temporal/gRPC/Coinbase SDK dependency paths. | Merge #1061 after #1060, regenerate lockfiles, and verify dependency resolution plus audit output. |
| 3 | [apexbusiness-systems/APEX-OmniHub#1050](https://github.com/apexbusiness-systems/APEX-OmniHub/pull/1050) | HIGH | `dangerouslySetInnerHTML` XSS exposure on the Home page marketing surface. | Merge #1050 after the RLS and CVE blockers are cleared. |

## M-04 / M-05 enforcement

M-04 must remain a **hard fail** while any item in the PR queue above is open or unresolved.

Required M-04 checks:

1. Confirm no non-`service_role` RLS policy contains `USING (true)` or `WITH CHECK (true)` without a documented, reviewed exception.
2. Confirm `man_tasks` has no `operator_role` policy that grants unrestricted SELECT or UPDATE access.
3. Confirm package resolution eliminates vulnerable `protobufjs` and `axios` versions from every direct and transitive path.
4. Confirm no production marketing surface uses `dangerouslySetInnerHTML` for renderable copy, SVG, or user-influenced content.
5. Attach PR merge evidence, lockfile evidence, audit output, and smoke-test output to the M-04 audit packet.

M-05 proof site launch is blocked until M-04 passes with **zero critical and zero high findings**.

## Post-merge validation packet

Run these checks after the PRs land in APEX-OmniHub main and before promoting any public proof site:

```bash
# RLS posture: reject unrestricted non-service-role policies.
psql "$DATABASE_URL" -f ops/sql/rls_audit.sql

# Targeted MAN Mode policy inspection.
psql "$DATABASE_URL" -c "select policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'man_tasks' order by policyname;"

# Dependency tree proof.
npm ls protobufjs axios
npm audit --audit-level=high

# Application regression proof.
npm run test
npm run build
```

## Release manager checklist

- [ ] #1060 merged into `main`.
- [ ] #1058 closed or explicitly marked superseded by #1060.
- [ ] #1061 merged into `main`.
- [ ] #1050 merged into `main`.
- [ ] M-04 evidence packet attached with zero critical/high findings.
- [ ] M-05 proof site launch approved only after M-04 passes.
