<!-- Version: v1.3.0 | Date: 2026-04-07 | Status: Public -->
# Ops Ingress and Rendering Pipeline

## Ingress Routes
- `/ops/imports/teams`
- `/ops/imports/players`
- `/ops/imports/schedules`
- `/ops/imports/events`
- `/ops/potg/parse`
- `/ops/potg/submit`
- `/ops/store/media`
- `/ops/scores/import`
- `/ops/scores/parse-image`
- `/ops/ingest/presign`
- `/ops/ingest/submit`

## Parser and Normalization
- POTG parser extracts player, team, and stat lines.
- Scoreboard parser extracts team labels, scores, and status.
- Image preparation enforces deterministic resize dimensions before persistence.

## Persistence and Projection
- Ingest writes are projected through publication layer records.
- Public pages render from publication-safe rows, not raw upload payloads.

## Public Render Endpoints
- `/api/public/media`
- `/api/public/potg`
- `/api/public/schedule`
- `/api/scores`

## Fit/Resize Contract
- Portrait card target: `560x747`
- Landscape graphic target: `747x560`
- Store media target: `800x800`
- Grid containers render with `3:4` card constraints.

## Evidence
- `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.3.0.md`
- `docs/quality/evidence/ingress-render-evidence-2026-04-07.json`
