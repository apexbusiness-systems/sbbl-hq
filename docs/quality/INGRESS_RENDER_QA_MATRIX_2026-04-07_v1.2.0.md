<!-- Version: v1.2.0 | Date: 2026-04-07 | Status: Current -->
# Ingress/Render QA Matrix (Signed)

**Version:** v1.2.0  
**Last Updated:** 2026-04-07  
**Scope:** deterministic hardening pass for ingress/upload/render reliability, parser checks, and environment-boundary enforcement.

## Deterministic Verdict

- **Code hardening pass:** COMPLETE (worker-owned media ingest + env-key mismatch guard).
- **Route wiring baseline:** PASS (**90/90**) via existing endpoint-by-endpoint matrix in `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`.
- **Parser unit/security baseline:** PASS.
- **Live Ops POTG form upload run (9 images):** **FAIL on deployed environment**.
  - `POST /ops/potg/parse` returned 500 (`server_misconfigured`) in the run.
  - Supabase storage write path returned 400 (`row-level security policy`) for every file.
  - `POST /ops/potg/submit` did not complete successfully in this live run.

**Reliability status:** NOT 100% on the currently deployed environment until runtime secrets are corrected and hardened code is deployed.

## Hardening Changes Audited in This Pass

1. `src/pages/Ops.tsx` no longer performs direct browser-side `media` bucket writes.
2. POTG/store uploads are now sent as `imageUpload` payloads to Worker ingress.
3. `src/worker/index.ts` now performs storage writes using service-role admin client (`uploadInlineMediaImage`).
4. Worker now rejects publishable/anon key misuse in `SUPABASE_SERVICE_ROLE_KEY` with explicit `supabase_service_key_invalid` error.
5. Guard tests extended to enforce worker-owned upload architecture and service-key separation.

## Evidence Artifacts (This Pass)

| Artifact | Purpose |
|---|---|
| `docs/quality/evidence/hardening_build_2026-04-07.log` | Build verification after hardening changes |
| `docs/quality/evidence/hardening_tests_2026-04-07.log` | Targeted regression + env-boundary + route wiring tests |
| `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.md` | Human-readable live Ops 9-file upload matrix |
| `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.json` | Machine-readable live Ops 9-file upload matrix |
| `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md` | Full endpoint-by-endpoint 90-route checklist |

## SHA-256 Digests (This Pass)

| Artifact | SHA-256 |
|---|---|
| `docs/quality/evidence/hardening_build_2026-04-07.log` | `667F0461C9B541B4342A31F25351F87115A4509427C9AD4FB6537DC86A9BE232` |
| `docs/quality/evidence/hardening_tests_2026-04-07.log` | `DC8A06871B6A1BE1AE014F0B63733FAE94C511781CBE953E82B5ACCDEC07192C` |
| `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.md` | `95AB6434512006FCC8D3FF0B4B8C11E7B1DC65883E784B30E95CCD5E3C5418B3` |
| `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.json` | `FE26C9BB611D8DB06AE426708DE2F14AECB69B71A733CCF5C14910D558FBBFED` |

## Live Ops Upload Summary (9 Files)

| Check | Result |
|---|---|
| Files attempted through Ops POTG form | 9/9 |
| UI parse error banner (`server_misconfigured`) | present |
| Storage upload success (`200`) | 0/9 |
| Storage upload failure (`400`) | 9/9 |
| RLS error surfaced in UI | yes |
| Successful submit job creation | 0/9 |

Detailed per-file evidence: `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.md`.

## Parser Checklist (Current)

| Surface | Result | Evidence |
|---|---|---|
| CSV parser (`parseCsv`) | PASS | `hardening_tests_2026-04-07.log` |
| CSV security parser guards | PASS | `hardening_tests_2026-04-07.log` |
| Stripe signature parser | PASS | `hardening_tests_2026-04-07.log` |
| Stats validator | PASS | `hardening_tests_2026-04-07.log` |
| POTG parse ingress route wiring | PASS (router); live runtime currently misconfigured | `hardening_tests_2026-04-07.log`, `ops_console_potg_upload_matrix_2026-04-07.*` |

## Signature

- Signed by: **APEX Codex**
- Timestamp: **2026-04-07T16:09:00-06:00**
- Attestation: Artifacts listed above were generated from this hardening pass and integrity-bound via SHA-256 digests.
