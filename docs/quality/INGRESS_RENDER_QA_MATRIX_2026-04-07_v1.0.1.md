<!-- Version: v1.0.1 | Date: 2026-04-07 | Status: Current -->
# Ingress/Render QA Matrix (Signed)

**Version:** v1.0.1
**Last Updated:** 2026-04-07
**Scope:** Worker ingress + render route surfaces and parser boundaries

## Environment Boundary Assertion

Frontend build-time env (`VITE_*`) and Worker runtime secrets (`SUPABASE_*`, `STRIPE_*`) remain strictly separated. This pass includes explicit guard coverage to prevent cross-system leakage.

## Evidence Artifacts

| Artifact | Purpose |
|---|---|
| `docs/quality/evidence/build_2026-04-07.log` | Production build verification |
| `docs/quality/evidence/env_boundary_2026-04-07.log` | Env separation guard tests |
| `docs/quality/evidence/parsers_2026-04-07.log` | Parser correctness/security tests |
| `docs/quality/evidence/ingress_render_worker_2026-04-07.log` | Endpoint-by-endpoint worker ingress/render run |
| `docs/quality/evidence/full_test_regression_2026-04-07.log` | Full regression suite evidence |
| `docs/quality/evidence/route_inventory_2026-04-07.json` | Route registry inventory (method/path/regex) |
| `docs/quality/evidence/worker_route_coverage_2026-04-07.json` | Endpoint coverage-to-test mapping |

## Evidence Artifact Digests (SHA-256)

| Artifact | SHA-256 |
|---|---|
| `docs/quality/evidence/build_2026-04-07.log` | `68087F2629717115BBE79E64B651753D53471282B757E335DEE32E500AC193D5` |
| `docs/quality/evidence/env_boundary_2026-04-07.log` | `89CF01C346130313079DBB9DC4099B2851ABA239A356DF60C764B0D73A00ABA5` |
| `docs/quality/evidence/parsers_2026-04-07.log` | `7A533AAC86A20E241D7EDBA4160B6664A1680A50C0ED5DCA34C9530815F25B8B` |
| `docs/quality/evidence/ingress_render_worker_2026-04-07.log` | `B75F5E28EE6180AA7A980AF5E4BAB3DDD7CE47B3DB5D82D4C7D18693BC6027A9` |
| `docs/quality/evidence/full_test_regression_2026-04-07.log` | `3517C7BF196AF564037AC5A238F48DE7C2E042CC767A1BAC0085652E5373B726` |
| `docs/quality/evidence/route_inventory_2026-04-07.json` | `D721DF9EE8D618B7631BB40CB7EBB4B0D395C01E3F17802A24CBA11645611069` |
| `docs/quality/evidence/worker_route_coverage_2026-04-07.json` | `E3CF2AE306EC3E508A17A3880120EE38B73C99C5511AC7C492E02FDAF585A8EF` |

## Endpoint-by-Endpoint Ingress/Render Checklist

| Method | Endpoint | Class | Validation | Result | Test Evidence | Artifact(s) |
|---|---|---|---|---|---|---|
| `GET` | `/api/public-config` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-ops-health.test.ts`, `worker-routes.test.ts`, `worker-scores-route.test.ts`, `worker-security-headers.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/public/home` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/public/media` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/public/potg` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/public/products` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/public/schedule` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/scores` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-scores-route.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/access` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/comments` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stream-hardening.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/preview` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/reactions` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/reactions` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/streams/status` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stream-hardening.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/api/teams` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/ops/imports/history` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/ops/ingest/:jobId` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `GET` | `/ops/ingest/reconcile` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/ingress` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-ingress.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/invite/redeem` | `ingress` | runtime smoke + route registry | PASS | `worker-turnstile-rate-limit.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/comments` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stream-hardening.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/purchase` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-turnstile-rate-limit.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/react` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stream-hardening.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session/end` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session/heartbeat` | `render` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stream-hardening.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/imports/events` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/imports/players` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/imports/schedules` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/imports/teams` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-ops-imports.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/ingest/:jobId/approve` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/ingest/:jobId/reject` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/ingest/:jobId/replay` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/potg/parse` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/potg/submit` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/scores/game` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/scores/import` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/scores/parse-image` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/ops/store/media` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/sync/drain` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |
| `POST` | `/webhooks/stripe` | `ingress` | runtime smoke + route registry | PASS | `worker-ingress-render-checklist.test.ts`, `worker-stripe-webhook.test.ts` | `worker_route_coverage_2026-04-07.json`; `ingress_render_worker_2026-04-07.log` |

## Parser Checklist

| Parser Surface | Validation | Result | Evidence |
|---|---|---|---|
| `src/lib/parseCsv.ts` | Unit parser coverage (20 tests) | PASS | `parsers_2026-04-07.log` (`parseCsv.test.ts`) |
| `src/lib/parseCsv.ts` security guards | Malformed/injection parsing checks (3 tests) | PASS | `parsers_2026-04-07.log` (`parseCsv.security.test.ts`) |
| `parseStripeSignature` (`src/worker/index.ts`) | Signature token parsing edge cases (8 tests) | PASS | `parsers_2026-04-07.log` (`stripe-signature-parsing.test.ts`) |
| Stats validation (`src/test/stats-validator.test.ts`) | Stat payload validation edge cases (2 tests) | PASS | `parsers_2026-04-07.log` |
| Scoreboard image parse route (`POST /ops/scores/parse-image`) | Route wiring + runtime smoke (non-404) | PASS | `ingress_render_worker_2026-04-07.log`; `worker-ingress-render-checklist.test.ts` |
| POTG parse route (`POST /ops/potg/parse`) | Route wiring + runtime smoke (non-404) | PASS | `ingress_render_worker_2026-04-07.log`; `worker-ingress-render-checklist.test.ts` |

## Result Summary

- In-scope ingress/render routes discovered: **40**
- In-scope ingress/render routes runtime-smoke covered: **40**
- In-scope parser surfaces validated: **6/6 PASS**
- Targeted test status: **PASS** (`env boundary 5/5`, `parser 33/33`, `ingress/render 2/2`)
- Full regression status: **PASS** (`219 passed`, `7 skipped`, `0 failed`)

## Signature

- Signed by: **APEX Codex**
- Timestamp: **2026-04-07T13:15:19-06:00**
- Attestation: All listed artifacts were regenerated and hashed in this run; digest table above binds the evidence set to this signed matrix.
