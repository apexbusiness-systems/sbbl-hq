# SBBL-HQ Documentation Master Index

**Version:** 2.1.0  
**Last Updated:** 2026-05-13  
**Maintainer:** APEX Business Systems Ltd. — Engineering  
**Status:** AUTHORITATIVE — all agents and devs must read this before editing

> [!IMPORTANT]
> This index is the canonical navigation hub for all SBBL-HQ documentation.
> Every doc referenced here has been verified against actual repo source files.
> Do NOT trust any agent output that contradicts a file in this index.

---

## 1. Start Here (Onboarding)

| Document | Purpose | Verified Against |
|----------|---------|-----------------|
| [`CLAUDE.md`](../CLAUDE.md) | Agent hard rules, architecture overview, validation gates | `eslint.config.js`, `src/test/no-mock-in-production.test.ts`, `ci.yml` |
| [`docs/onboarding/AGENT_ONBOARDING.md`](onboarding/AGENT_ONBOARDING.md) | Step-by-step onboarding for new agents/devs | Full repo audit 2026-05-08 |
| [`README.md`](../README.md) | Project overview | Active |

---

## 2. Architecture

| Document | Version | Contents |
|----------|---------|---------|
| [`docs/architecture/ARCHITECTURE_v1.2.0.md`](architecture/ARCHITECTURE_v1.2.0.md) | 1.2.0 | System design, data flow |
| [`docs/architecture/COMPLETE_CODEBASE_MAP_v1.0.0.md`](architecture/COMPLETE_CODEBASE_MAP_v1.0.0.md) | 1.0.0 | Full source tree map |
| [`docs/architecture/API_REFERENCE_v1.2.0.md`](architecture/API_REFERENCE_v1.2.0.md) | 1.2.0 | Worker endpoint table |
| [`docs/architecture/DB_SCHEMA_v1.2.0.md`](architecture/DB_SCHEMA_v1.2.0.md) | 1.2.0 | Supabase schema |
| [`docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md`](architecture/STREAM_INDEPENDENCE_CONTRACT.md) | 1.x | Stream ≠ Game law |
| [`docs/architecture/CANONICAL_DATA_PIPELINE_v1.0.0.md`](architecture/CANONICAL_DATA_PIPELINE_v1.0.0.md) | 1.0.0 | Data flow patterns |

---

## 3. Operations & Runbooks

| Document | Purpose |
|----------|---------|
| [`ops/runbooks/DEPLOY_RUNBOOK.md`](../ops/runbooks/DEPLOY_RUNBOOK.md) | Production deploy procedure |
| [`ops/runbooks/INCIDENT_RUNBOOK.md`](../ops/runbooks/INCIDENT_RUNBOOK.md) | Incident response |
| [`ops/runbooks/BROADCAST_RUNBOOK.md`](../ops/runbooks/BROADCAST_RUNBOOK.md) | Go-Live stream operations |
| [`ops/runbooks/DATABASE_RUNBOOK.md`](../ops/runbooks/DATABASE_RUNBOOK.md) | Supabase DB operations |

---

## 4. Security & Protocols

| Document | Purpose |
|----------|---------|
| [`docs/protocols/no-mock-in-production.md`](protocols/no-mock-in-production.md) | No-mock enforcement |
| [`PAYWALL_ENFORCEMENT_POLICY.md`](../PAYWALL_ENFORCEMENT_POLICY.md) | Paywall security contract |
| [`ONE_DEVICE_POLICY.md`](../ONE_DEVICE_POLICY.md) | Session device constraints |
| [`RESUME_POLICY.md`](../RESUME_POLICY.md) | Session resume behavior |

---

## 5. Quality & CI/CD

| Document | Purpose |
|----------|---------|
| [`docs/quality/CI_GATE_REFERENCE.md`](quality/CI_GATE_REFERENCE.md) | All CI jobs explained |
| [`docs/quality/TEST_COVERAGE_MAP.md`](quality/TEST_COVERAGE_MAP.md) | TODO — not yet created |
| [`STREAM_TEST_STRATEGY.md`](../STREAM_TEST_STRATEGY.md) | Stream-specific test plan |

---

## 6. Feature Flags

All feature flags live in `src/worker/bindings.d.ts` (Env interface). See [`docs/onboarding/FEATURE_FLAGS.md`](onboarding/FEATURE_FLAGS.md).

---

## 7. Deployment

| Document | Purpose |
|----------|---------|
| [`ops/runbooks/DEPLOY_RUNBOOK.md`](../ops/runbooks/DEPLOY_RUNBOOK.md) | Step-by-step deploy |
| [`wrangler.jsonc`](../wrangler.jsonc) | CF Worker config (source of truth) |
| [`wrangler.deploy.jsonc`](../wrangler.deploy.jsonc) | Production deploy config |

---

## 8. Media Intelligence Overhaul

**Version:** 1.0.0  
**Date:** 2026-05-13  

New capabilities in the Ops Console media tab:

| Feature | Endpoint | Key Column/RPC | Notes |
|---------|----------|----------------|-------|
| Pin Support | `PATCH /api/ops/media/publications/:id` | `pinned_at TIMESTAMPTZ` | NULL = not pinned; non-NULL = pinned timestamp |
| Bulk Archive | `POST /api/ops/media/bulk-archive` | `bulk_archive_media_publications()` RPC | Transactional atomicity; refuses pinned IDs |
| Restore | `POST /api/ops/media/publications/:id/restore` | Status → draft | Idempotent for non-archived |
| Stale Cleanup (Preview) | `POST /api/ops/media/stale-cleanup-preview` | 30d+ published, not pinned | Two-phase safety |
| Stale Cleanup (Execute) | `POST /api/ops/media/stale-cleanup-execute` | Re-validates server-side | Type "ARCHIVE" to confirm |
| Parser Confidence | — | `parser_confidence REAL`, `needs_review BOOLEAN` | Flagged at <0.5; warning at <0.7 |
| Search | `GET /api/ops/list/media?q=...` | `ILIKE` on title+subtitle | pg_trgm upgrade path documented |
| Newest-First | `GET /api/ops/list/media?orderBy=newest` | `created_at DESC NULLS LAST` | Default ordering; `sort_order` still available |

**Key files:** `src/components/OpsMediaLibrary/`, `src/hooks/useMedia*.ts`, `src/lib/api/ops.ts`, `src/lib/media/mediaParserSchema.ts`  
**Migration:** `supabase/migrations/20260513000000_media_intelligence_overhaul.sql`

---

## Ground-Truth Principle

> Every document in this index must be grounded in verified repo facts.  
> If a document references a file path, test name, or endpoint that does not exist in the repo, it is WRONG and must be corrected immediately.  
> Agents: run `npm run typecheck && npm run lint && npm test` to verify before claiming any gate passes.
