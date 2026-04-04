<!-- Version: v2.0.0 | Date: 2026-04-04 | Status: Current -->
# SBBL HQ — Documentation Hub

**Version:** v2.0.0
**Last Updated:** 2026-04-04
**Maintainer:** APEX Business Systems Ltd. — Engineering Lead

> Single source of truth for all SBBL HQ engineering, operational, and product documentation.
> All documents follow semantic versioning (`vMAJOR.MINOR.PATCH`) with UTC date stamps.

---

## Directory Structure

```
docs/
├── README.md                        ← This file — master index
├── architecture/                    ← System design & data contracts
├── security/                        ← RLS, auth model, content policies
├── operations/                      ← Runbooks, external bindings
├── deployment/                      ← Deploy procedures per platform
├── features/                        ← Feature-level technical specs
├── quality/                         ← Audits, gate reports, workflow reviews
├── onboarding/                      ← New engineer setup
├── protocols/                       ← Debugging & incident response
├── status/                          ← Point-in-time production snapshots
└── internal/                        ← Proprietary APEX frameworks
```

---

## Architecture

| Document | Version | Description |
|---|---|---|
| [ARCHITECTURE](./architecture/ARCHITECTURE_v1.1.0.md) | v1.1.0 | Full stack overview — Vite + React + Supabase + Vercel + Stripe |
| [DB SCHEMA](./architecture/DB_SCHEMA_v1.1.0.md) | v1.1.0 | Core migration schema — all domains, triggers, indexes |
| [API REFERENCE](./architecture/API_REFERENCE_v1.1.0.md) | v1.1.0 | Worker API endpoints, auth, idempotency |

---

## Security

| Document | Version | Description |
|---|---|---|
| [SECURITY MODEL](./security/SECURITY_MODEL_v1.1.0.md) | v1.1.0 | Auth, RLS, privilege boundaries, audit logging |
| [RLS MATRIX](./security/RLS_MATRIX_v1.1.0.md) | v1.1.0 | Row-Level Security access matrix — all table domains |
| [HEADSHOT POLICY](./security/HEADSHOT_POLICY_v1.1.0.md) | v1.1.0 | Image moderation outcomes and routing rules |

---

## Operations

| Document | Version | Description |
|---|---|---|
| [OPERATIONS RUNBOOK](./operations/OPERATIONS_RUNBOOK_v1.2.0.md) | v1.2.0 | Env setup, deployments, DB ops, emergency procedures |
| [EXTERNAL BINDINGS](./operations/EXTERNAL_BINDINGS_v1.0.0.md) | v1.0.0 | Third-party secrets and service configuration checklist |
| [OPERATIONS RUNBOOK (archived)](./operations/OPERATIONS_RUNBOOK_v1.0.0_archived.md) | v1.0.0 | Superseded — retained for historical reference |

---

## Deployment

| Document | Version | Description |
|---|---|---|
| [SUPABASE SETUP](./deployment/SUPABASE_SETUP_v1.1.0.md) | v1.1.0 | Project link, migrations, storage, type generation |
| [DEPLOY CLOUDFLARE](./deployment/DEPLOY_CLOUDFLARE_v1.1.0.md) | v1.1.0 | Cloudflare Workers — local, staging, production, rollback |
| [PWA + CAPACITOR SETUP](./deployment/PWA_CAPACITOR_SETUP_v1.1.0.md) | v1.1.0 | Service worker config, iOS/Android native build |

---

## Features

| Document | Version | Description |
|---|---|---|
| [STATS PIPELINE](./features/STATS_PIPELINE_v1.1.0.md) | v1.1.0 | 4-stage stat submission — draft → save → finalize → leaderboard |
| [STREAM GATING](./features/STREAM_GATING_v1.1.0.md) | v1.1.0 | PPV entitlement, access sessions, watermark logging |

---

## Quality

| Document | Version | Description |
|---|---|---|
| [RELEASE GATE AUDIT 2026-04-04](./quality/RELEASE_GATE_AUDIT_2026-04-04_v1.0.0.md) | v1.0.0 | 10K concurrency hardening — gate decision: PASS |
| [LIVESTREAM WORKFLOW AUDIT 2026-04-04](./quality/LIVESTREAM_WORKFLOW_AUDIT_2026-04-04.md) | v1.0.0 | Live page + stream control plane capacity and latency review |
| [BUILD AUDIT 2026-03-28](./quality/BUILD_AUDIT_2026-03-28_v1.0.0.md) | v1.0.0 | End-to-end build audit — historical baseline |

---

## Onboarding

| Document | Version | Description |
|---|---|---|
| [DEVELOPER ONBOARDING](./onboarding/DEVELOPER_ONBOARDING_v1.0.0.md) | v1.0.1 | New engineer setup — env, tools, first deploy |

---

## Protocols

| Document | Version | Description |
|---|---|---|
| [DEBUGGING PROTOCOL](./protocols/DEBUGGING_PROTOCOL_v1.0.0.md) | v1.0.0 | Systematic debugging methodology for SBBL HQ |
| [EMERGENCY RESPONSE PROTOCOL](./protocols/EMERGENCY_RESPONSE_PROTOCOL_v1.0.0.md) | v1.0.0 | Incident response — escalation, rollback, comms |

---

## Production Status Snapshots

| Document | Version | Description |
|---|---|---|
| [PRODUCTION STATUS 2026-03-28](./status/PRODUCTION_STATUS_2026-03-28_v1.0.0.md) | v1.0.0 | Point-in-time readiness snapshot |

---

## Internal Frameworks

| Document | Version | Description |
|---|---|---|
| [APEX DEBUG FRAMEWORK](./internal/APEX_DEBUG_FRAMEWORK_v1.0.0.md) | v1.0.0 | Proprietary APEX omniscient debugging intelligence |
| [APEX POWER FRAMEWORK](./internal/APEX_POWER_FRAMEWORK_v1.0.0.md) | v1.0.0 | Proprietary APEX universal execution meta-skill |

---

## Documentation Governance

| Rule | Policy |
|---|---|
| **Versioning** | Semantic versioning — `vMAJOR.MINOR.PATCH`. Bump MINOR for content additions, PATCH for corrections, MAJOR for structural rewrites. |
| **Dating** | UTC calendar dates `YYYY-MM-DD` in all filenames and front-matter. |
| **Front-matter** | Every document opens with `<!-- Version: vX.Y.Z \| Date: YYYY-MM-DD \| Status: Current -->` |
| **Ownership** | Engineering lead: runbooks, protocols, architecture. Release manager: quality reports, status snapshots. Product: feature specs. |
| **Review cadence** | Architecture/security: per schema migration. Runbooks: monthly or post-incident. Quality audits: per release candidate. Onboarding: quarterly. |
| **Deprecation** | Superseded docs renamed `*_archived.md` and retained for historical reference. Never deleted. |

## Definition of "Release-Ready" State

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass with zero errors.
- All RLS policies active on every `public` schema table — verified by `rls_audit` log.
- PWA service worker generated — 47+ precached entries.
- Sentry DSN configured and error tracking confirmed active.
- Stripe webhook idempotency table seeded and endpoint verified.
- All environment variables from `EXTERNAL_BINDINGS` checklist confirmed set in production.
