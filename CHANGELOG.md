<!-- Version: v1.1.0 | Date: 2026-04-16 | Status: Current -->
# CHANGELOG

All notable changes to SBBL HQ are documented in this file.
Versioning follows [semantic versioning](https://semver.org) with UTC date stamps.

---

## 2026-04-16 — v1.1.0 — Documentation Audit & Consolidation

- Audited every document in the repository root and under `docs/`.
- Removed superseded specs: `docs/features/STREAM_GATING_v1.4.0.md` (replaced by v1.5.0) and `docs/quality/LIVESTREAM_WORKFLOW_AUDIT_2026-04-04.md` (replaced by the 2026-04-09 integrity audit).
- Renamed unversioned architecture docs under `docs/architecture/` with standard `_vX.Y.Z.md` suffix:
  - `CANONICAL_DATA_PIPELINE` → `architecture/CANONICAL_DATA_PIPELINE_v1.0.0.md`
  - `COMPLETE_CODEBASE_MAP.md` → `architecture/COMPLETE_CODEBASE_MAP_v1.0.0.md`
  - `api_contracts.md` → `architecture/STORE_API_CONTRACTS_v1.0.0.md`
  - `store_architecture.md` → `architecture/STORE_ARCHITECTURE_v1.0.0.md`
- Renamed quality docs to include version suffix and added standard front-matter:
  - `LIVESTREAM_INGEST_BROADCAST_SYSTEM_INTEGRITY_AUDIT_2026-04-09.md` → `_v1.0.0.md`
  - `MEDIA_PUBLICATIONS_SORT_ORDER_MIGRATION_2026-04-16.md` → `_v1.0.0.md`
  - `PRODUCTION_ENV_VERIFICATION_2026-04-15.md` → `_v1.0.0.md`
- Added `<!-- Version | Date | Status -->` front-matter to all docs previously missing it.
- Rewrote `README.md` doc links — every target now points at an existing file at its current version.
- Rewrote `docs/README.md` master index — reflects actual on-disk file set, adds Agents section, links root-level policy docs (ONE_DEVICE, PAYWALL, RESUME, STREAM_TEST_STRATEGY).

## 2026-04-16 — v1.0-store-canonicalization-hardening

- Standardized the database schema on `store_products`, `store_orders`, and `custom_quote_requests`.
- Implemented robust server-side webhook syncing for store orders.
- Removed mock data paths from UI and properly fetched via Edge Workers.
- Enforced strict IDEMPOTENCY KEY propagation.
- Canonicalized internal API data maps.
