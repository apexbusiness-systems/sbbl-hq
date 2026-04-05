<!-- Version: v1.0.0 | Date: 2026-04-04 | Status: Current -->
# Stabilization Pass — 2026-04-04

## Baseline (pre-edit)

| Command           | Result                                      |
|-------------------|---------------------------------------------|
| `npm run lint`    | PASS                                        |
| `npm run typecheck` | FAIL (pre-existing: vite.config.ts plugin array type) |
| `npm run build`   | PASS                                        |
| `npm run test`    | PASS — 33 files, 137 tests                  |
| Playwright        | Not available in environment                 |

## Post-edit verification

| Command           | Result                                      |
|-------------------|---------------------------------------------|
| `npm run lint`    | PASS                                        |
| `npm run typecheck` | **PASS** (fixed)                            |
| `npm run build`   | PASS                                        |
| `npm run test`    | PASS — **36 files, 146 tests** (+3 files, +9 tests) |
| Playwright        | Not available in environment                 |

## What changed

### Phase 1 — Public contract stabilization
- `src/lib/api/public.ts` — normalized `fetchPublicHome()` to wrap flat Worker response into `{ ok, data }` so callers (`Home.tsx`, `Live.tsx`) get `result.data` correctly; updated `PublicHomeData` type to match actual Worker output (removed phantom `hero`/`featured_games`/`news` fields, added `league`/`leagues`)
- `src/worker/index.ts` — registered missing `GET /api/public/schedule` and `GET /api/public/potg` routes (handlers existed but were unrouted)
- `src/test/worker-public-contract.test.ts` — new: 5 tests verifying route registration and handler existence
- `src/test/public-home-normalization.test.ts` — new: 1 test verifying client normalization wrapper

### Phase 2 — Stream semantics normalization
- `src/lib/api/stream.ts` — updated `collectionId` JSDoc from "Switcher Studio collection ID" to truthful "Stream URL" description; updated route comment
- `src/pages/Live.tsx` — aligned inline comments to actual behavior (stream URL, not "twitch URL")
- `src/pages/Ops.tsx` — changed input placeholder from "Switcher collection ID" to "Stream URL"

### Phase 3 — Response hardening
- `src/worker/index.ts` — fixed `addSecurityHeaders()` where CSP and HSTS headers were joined on a single line after a `//` comment, making them dead code; broke them into separate lines so all headers are actually emitted
- Applied `addSecurityHeaders()` centrally to all Worker responses (route handlers, error responses, 404)
- Applied `checkRateLimit(ip)` to the Stripe webhook endpoint (anonymous, mutation-heavy)
- `src/test/worker-security-headers.test.ts` — new: 3 tests verifying headers on 200/404/401 responses

### Phase 4 — Stripe canonicalization
- `supabase/functions/stripe-webhook/index.ts` — added DEPRECATED header marking Edge Function as archival
- Updated `docs/security/SECURITY_MODEL_v1.2.0.md`, `docs/operations/OPERATIONS_RUNBOOK_v1.3.0.md`, `docs/features/STREAM_GATING_v1.2.0.md`, `docs/operations/SUPABASE_MONITORING_RUNBOOK_v1.0.0.md` to reference Worker as canonical Stripe webhook handler

### Phase 5 — Worker decomposition
- Created `src/worker/shared.ts` with `HandlerCtx`, `Handler`, and `json` types/utilities
- Created `src/worker/routes/public.ts` with extracted `handlePublicConfig`, `handlePublicHome`, `handlePublicSchedule`, `handlePublicPotg`
- `src/worker/index.ts` — imports from extracted modules via const aliases (preserves route table references); reduced from 4232 to 4114 lines

### Phase 6 — Runtime config truthfulness
- `README.md` — corrected key naming: was "ANON_KEY is canonical, PUBLISHABLE_KEY is dead" → now truthfully documents both are supported with PUBLISHABLE_KEY preferred

### Phase 7 — Type-safety honesty
- `vite.config.ts` — fixed plugin array type by replacing `cond && plugin()` pattern with `...(cond ? [plugin()] : [])` spread, eliminating falsy values from the array and resolving the typecheck failure
- `README.md` — corrected "TypeScript strict" claim to note strict mode is not yet enabled

### Phase 8 — Documentation
- Updated Stripe references in 4 doc files
- Updated monitoring runbook Stripe section

## Compatibility decisions
- **Client-side normalization** for public home contract (avoids changing Worker's public API)
- **Wire field names preserved** for stream config (`collectionId` kept as field name; only comments/labels updated)
- **Additive route registration** (added missing routes; no removals)
- **Deprecation over deletion** for Edge Function stripe-webhook
- **Re-export pattern** for Worker extraction (const aliases preserve route table references)
- **Rate limiting narrow scope** (only Stripe webhook endpoint, not global)

## Pre-existing failures resolved
- `npm run typecheck` failure (vite.config.ts plugin array type) — **FIXED**

## Deferred items
- Full strict TypeScript enablement (`strict: true` in tsconfig.app.json — requires dedicated pass to fix cascading errors)
- Playwright e2e coverage (not available in this environment)
- Global rate limiting strategy (needs per-endpoint analysis beyond Stripe webhook)
- Edge Function stripe-webhook removal (requires deployment verification that Stripe dashboard points to Worker URL, not Edge Function)
- Further Worker decomposition (remaining ~4100 lines; can be done incrementally)
