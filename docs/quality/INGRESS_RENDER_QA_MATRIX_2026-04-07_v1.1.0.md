<!-- Version: v1.1.0 | Date: 2026-04-07 | Status: Current -->
# Ingress/Render QA Matrix (Signed)

**Version:** v1.1.0
**Last Updated:** 2026-04-07
**Scope:** Full Worker route registry (all methods), ingress/render surfaces, parser boundaries, and environment boundary separation

## Environment Boundary Assertion

Frontend build-time env (`VITE_*`) and Worker runtime secrets (`SUPABASE_*`, `STRIPE_*`, `GROQ_API_KEY`) remain strictly separated. Guard tests confirm no cross-system leakage.

## Evidence Artifacts

| Artifact | Purpose |
|---|---|
| `docs/quality/evidence/build_2026-04-07.log` | Production build verification |
| `docs/quality/evidence/env_boundary_2026-04-07.log` | Env-system separation guard tests |
| `docs/quality/evidence/parsers_2026-04-07.log` | Parser correctness/security tests |
| `docs/quality/evidence/ingress_render_worker_2026-04-07.log` | Legacy ingress/render (40-route) checklist evidence |
| `docs/quality/evidence/all_worker_routes_2026-04-07.log` | Full 90-route endpoint-by-endpoint wiring checklist evidence |
| `docs/quality/evidence/full_test_regression_2026-04-07.log` | Full regression suite evidence |
| `docs/quality/evidence/route_inventory_2026-04-07.json` | Route registry inventory (90 routes) |
| `docs/quality/evidence/worker_route_coverage_2026-04-07.json` | Per-route evidence mapping (90 route keys) |

## Evidence Artifact Digests (SHA-256)

| Artifact | SHA-256 |
|---|---|
| `docs/quality/evidence/build_2026-04-07.log` | `68087F2629717115BBE79E64B651753D53471282B757E335DEE32E500AC193D5` |
| `docs/quality/evidence/env_boundary_2026-04-07.log` | `89CF01C346130313079DBB9DC4099B2851ABA239A356DF60C764B0D73A00ABA5` |
| `docs/quality/evidence/parsers_2026-04-07.log` | `7A533AAC86A20E241D7EDBA4160B6664A1680A50C0ED5DCA34C9530815F25B8B` |
| `docs/quality/evidence/ingress_render_worker_2026-04-07.log` | `B75F5E28EE6180AA7A980AF5E4BAB3DDD7CE47B3DB5D82D4C7D18693BC6027A9` |
| `docs/quality/evidence/all_worker_routes_2026-04-07.log` | `B6C5DB58847F90CA8EDA6B5AEE4375744121DEC1AB0DA7D48FF403711811B8A2` |
| `docs/quality/evidence/full_test_regression_2026-04-07.log` | `207034085FF69074FDB7C9FCFC6BD27D59314400F370F0D65507630913D96211` |
| `docs/quality/evidence/route_inventory_2026-04-07.json` | `D721DF9EE8D618B7631BB40CB7EBB4B0D395C01E3F17802A24CBA11645611069` |
| `docs/quality/evidence/worker_route_coverage_2026-04-07.json` | `A74312F0E0E28E7EA6CBD1886FEC8595900C4DC9F1A4B16CAF20F183805B6243` |

## Endpoint-by-Endpoint Route Checklist

| Method | Registered Route | Concrete Probe Path | Class | Result | Test Evidence | Artifact(s) |
|---|---|---|---|---|---|---|
| `DELETE` | `/api/cart/items/:itemId` | `/api/cart/items/item-1` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `DELETE` | `/ops/events/:id` | `/ops/events/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `DELETE` | `/ops/players/:id` | `/ops/players/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `DELETE` | `/ops/products/:id` | `/ops/products/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `DELETE` | `/ops/teams/:id` | `/ops/teams/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/^\/ops\/ingest\/(?<jobId>[^\/]+)\/?$/` | `/ops/ingest/job-1` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/^\/ops\/ingest\/reconcile\/?$/` | `/ops/ingest/reconcile` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/billing/history` | `/api/billing/history` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/cart` | `/api/cart` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/games/:id/stat-sheet` | `/api/games/id-1/stat-sheet` | `stats` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/leaderboards` | `/api/leaderboards` | `stats` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/profile/me` | `/api/profile/me` | `profile` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public-config` | `/api/public-config` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-public-contract.test.ts, worker-routes.test.ts, worker-security-headers.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public/home` | `/api/public/home` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public/media` | `/api/public/media` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public/potg` | `/api/public/potg` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public/products` | `/api/public/products` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/public/schedule` | `/api/public/schedule` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/scores` | `/api/scores` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-scores-route.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/stats` | `/api/stats` | `stats` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/access` | `/api/streams/game-1/access` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/comments` | `/api/streams/game-1/comments` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stream-hardening.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/preview` | `/api/streams/game-1/preview` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/:gameId/reactions` | `/api/streams/game-1/reactions` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/reactions` | `/api/streams/reactions` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/streams/status` | `/api/streams/status` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stream-hardening.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/api/teams` | `/api/teams` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/auth/session` | `/auth/session` | `auth` | PASS | worker-all-routes-wiring.test.ts, worker-auth.test.ts, worker-routes.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/access/lookup` | `/ops/access/lookup` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/bootstrap` | `/ops/bootstrap` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/coach/requests` | `/ops/coach/requests` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/headshots` | `/ops/headshots` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/health` | `/ops/health` | `ingress` | PASS | worker-all-routes-wiring.test.ts, worker-ops-health.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/imports/history` | `/ops/imports/history` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/list/events` | `/ops/list/events` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/list/players` | `/ops/list/players` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/list/products` | `/ops/list/products` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/list/teams` | `/ops/list/teams` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/metrics-lite` | `/ops/metrics-lite` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/publish-jobs` | `/ops/publish-jobs` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/revenue` | `/ops/revenue` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/review` | `/ops/review` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/streams/config` | `/ops/streams/config` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `GET` | `/ops/streams/sessions` | `/ops/streams/sessions` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `PATCH` | `/ops/events/:id` | `/ops/events/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `PATCH` | `/ops/players/:id` | `/ops/players/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `PATCH` | `/ops/products/:id` | `/ops/products/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `PATCH` | `/ops/schedules/:id` | `/ops/schedules/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `PATCH` | `/ops/teams/:id` | `/ops/teams/id-1` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/^\/ops\/ingest\/(?<jobId>[^\/]+)\/approve\/?$/` | `/ops/ingest/job-1/approve` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/^\/ops\/ingest\/(?<jobId>[^\/]+)\/reject\/?$/` | `/ops/ingest/job-1/reject` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/^\/ops\/ingest\/(?<jobId>[^\/]+)\/replay\/?$/` | `/ops/ingest/job-1/replay` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/^\/ops\/manual\/(?<kind>[^\/]+)\/(?<action>[^\/]+)\/?$/` | `/ops/manual/store/delete` | `api` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/cart/items` | `/api/cart/items` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/coach/request` | `/api/coach/request` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/games/:id/stats/draft` | `/api/games/id-1/stats/draft` | `stats` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/games/:id/stats/finalize` | `/api/games/id-1/stats/finalize` | `stats` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/ingress` | `/api/ingress` | `ingress` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-ingress.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/invite/generate` | `/api/invite/generate` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/invite/redeem` | `/api/invite/redeem` | `ingress` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-turnstile-rate-limit.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/orders` | `/api/orders` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/orders/:id/pay` | `/api/orders/id-1/pay` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/player/checkout` | `/api/player/checkout` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/profile/headshot` | `/api/profile/headshot` | `profile` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/profile/onboarding` | `/api/profile/onboarding` | `profile` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/rewards/redeem` | `/api/rewards/redeem` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/store/checkout` | `/api/store/checkout` | `commerce` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/comments` | `/api/streams/game-1/comments` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stream-hardening.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/purchase` | `/api/streams/game-1/purchase` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-turnstile-rate-limit.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/react` | `/api/streams/game-1/react` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session` | `/api/streams/game-1/session` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stream-hardening.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session/end` | `/api/streams/game-1/session/end` | `render` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/api/streams/:gameId/session/heartbeat` | `/api/streams/game-1/session/heartbeat` | `render` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stream-hardening.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/access/override` | `/ops/access/override` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/coach/:id/resolve` | `/ops/coach/id-1/resolve` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/imports/events` | `/ops/imports/events` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/imports/players` | `/ops/imports/players` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/imports/schedules` | `/ops/imports/schedules` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/imports/teams` | `/ops/imports/teams` | `ingress` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-ops-imports.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/potg/parse` | `/ops/potg/parse` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/potg/submit` | `/ops/potg/submit` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/review/:id/resolve` | `/ops/review/id-1/resolve` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/scores/game` | `/ops/scores/game` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/scores/import` | `/ops/scores/import` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/scores/parse-image` | `/ops/scores/parse-image` | `ingress` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-scores-route.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/store/media` | `/ops/store/media` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/streams/config` | `/ops/streams/config` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/ops/streams/status` | `/ops/streams/status` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/sync/drain` | `/sync/drain` | `ingress` | PASS | worker-all-routes-wiring.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |
| `POST` | `/webhooks/stripe` | `/webhooks/stripe` | `webhook` | PASS | worker-all-routes-wiring.test.ts, worker-ingress-render-checklist.test.ts, worker-stripe-webhook.test.ts | `worker_route_coverage_2026-04-07.json`; `all_worker_routes_2026-04-07.log` |

## Parser Checklist

| Parser Surface | Validation | Result | Evidence |
|---|---|---|---|
| `src/lib/parseCsv.ts` | Unit parser coverage (20 tests) | PASS | `parsers_2026-04-07.log` (`parseCsv.test.ts`) |
| `src/lib/parseCsv.ts` security guards | Malformed/injection parsing checks (3 tests) | PASS | `parsers_2026-04-07.log` (`parseCsv.security.test.ts`) |
| `parseStripeSignature` (`src/worker/index.ts`) | Signature token parsing edge cases (8 tests) | PASS | `parsers_2026-04-07.log` (`stripe-signature-parsing.test.ts`) |
| Stats payload validation (`src/test/stats-validator.test.ts`) | Stat validation edge cases (2 tests) | PASS | `parsers_2026-04-07.log` |
| Scoreboard image parse route (`POST /ops/scores/parse-image`) | Route wiring + parser-path handling | PASS | `all_worker_routes_2026-04-07.log`; `worker-all-routes-wiring.test.ts`; `parsers_2026-04-07.log` |
| POTG parse route (`POST /ops/potg/parse`) | Route wiring + parser-path handling | PASS | `all_worker_routes_2026-04-07.log`; `worker-all-routes-wiring.test.ts` |

## Result Summary

- Registered worker routes discovered: **90**
- Registered worker routes endpoint-by-endpoint validated (non-404 route match): **90/90 PASS**
- Ingress/render subset checklist: **40/40 PASS**
- Parser surfaces validated: **6/6 PASS**
- Full regression status: **PASS** (`220 passed`, `7 skipped`, `0 failed`)

## Signature

- Signed by: **APEX Codex**
- Timestamp: **2026-04-07T13:50:59-06:00**
- Attestation: Artifacts listed above were regenerated for this pass and integrity-bound by the SHA-256 digest table.
