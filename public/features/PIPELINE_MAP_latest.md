<!-- Version: v1.1.0 | Date: 2026-04-07 | Status: Current -->
# Super-Admin Ops Console Data Pipeline Map

**Version:** v1.1.0  
**Last Updated:** 2026-04-07  
**Supersedes:** v1.0.1

## 1. Ingress Surfaces

- **Ops Console (`src/pages/Ops.tsx`)**
  - CSV imports: teams, players, schedules, events, scores
  - POTG parser upload form
  - Scoreboard parser upload form
  - Store media upload form

## 2. Deterministic Upload Path (Hardened)

### Before (failure-prone)
- Browser resized image then attempted direct Supabase Storage upload using frontend client auth.
- This depended on Storage RLS policy permitting client writes and failed with 400/RLS in production.

### After (definitive architecture)
1. Browser still performs **deterministic resize** (`src/lib/imageResize.ts`) for consistent card dimensions.
2. Browser sends resized bytes as `imageUpload` payload to Worker (`/ops/potg/submit`, `/ops/store/media`).
3. Worker validates MIME/base64/size and performs storage write with **service-role** admin client.
4. Worker writes ingest/job/publication rows and returns stable job IDs.

## 3. Resize Logic (Canonical)

- `inferTargetDimensions(file)` returns:
  - Portrait: `560 x 747`, mode: `cover`
  - Landscape: `747 x 560`, mode: `cover`
- `resizeImageToFit(file, 800, 800)` for Store media defaults to `contain` unless mode overridden.

## 4. Parser + Validation

- POTG image parse: `POST /ops/potg/parse`
- Scoreboard parse: `POST /ops/scores/parse-image`
- CSV parser: `src/lib/parseCsv.ts`
- Worker route registry and ingress wiring verified through route checklist tests.

## 5. Environment Boundary Guarantees

- Frontend reads only `VITE_*` variables.
- Worker reads secure runtime secrets via Wrangler (`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, etc.).
- Worker guard now rejects publishable/anon key misuse as service-role key (`supabase_service_key_invalid`).

## 6. Live Runtime Finding (2026-04-07)

- Deployed environment currently shows:
  - `POST /ops/potg/parse` -> 500 (`server_misconfigured`)
  - storage upload attempts -> 400 (RLS)
- Evidence: `docs/quality/evidence/ops_console_potg_upload_matrix_2026-04-07.md`

## 7. Validation References

- Signed QA matrix (hardening): `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.2.0.md`
- Full endpoint checklist (90 routes): `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`
- Build/tests evidence: `docs/quality/evidence/hardening_build_2026-04-07.log`, `docs/quality/evidence/hardening_tests_2026-04-07.log`
