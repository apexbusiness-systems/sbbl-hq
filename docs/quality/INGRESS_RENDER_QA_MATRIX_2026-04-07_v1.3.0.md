<!-- Version: v1.3.0 | Date: 2026-04-07 | Status: Current -->
# Ingress/Render QA Matrix — Endpoint-by-Endpoint

## Scope
This matrix covers Ops ingest entry points, parser paths, render endpoints, and auto-resize guarantees.

Evidence sources:
- `src/test/endpoint-ingress-render-checklist.test.ts`
- `src/test/env-system-separation-audit.test.ts`
- `src/test/worker-ingest-pipeline.test.ts`
- `src/lib/imageResize.ts`
- `src/pages/Ops.tsx`
- `src/pages/Media.tsx`

## Ingress Endpoints
| Route | Type | Expected Behavior | Evidence Artifact | Status |
|---|---|---|---|---|
| `/ops/imports/teams` | Ingress | Team CSV rows accepted by worker ingress | `endpoint-ingress-render-checklist.test.ts` (`ingress route`) | PASS (static wiring) |
| `/ops/imports/players` | Ingress | Player CSV rows accepted by worker ingress | `endpoint-ingress-render-checklist.test.ts` (`ingress route`) | PASS (static wiring) |
| `/ops/imports/schedules` | Ingress | Schedule CSV rows accepted by worker ingress | `endpoint-ingress-render-checklist.test.ts` (`ingress route`) | PASS (static wiring) |
| `/ops/imports/events` | Ingress | Event CSV rows accepted by worker ingress | `endpoint-ingress-render-checklist.test.ts` (`ingress route`) | PASS (static wiring) |
| `/ops/potg/parse` | Parser Ingress | POTG parser endpoint is reachable from Ops | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/ops/potg/submit` | Ingress | POTG submit endpoint is wired and callable | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/ops/store/media` | Ingress | Store media submit endpoint is wired and callable | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/ops/scores/import` | Ingress | Scores CSV import route is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |
| `/ops/scores/parse-image` | Parser Ingress | Scoreboard parse route is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |
| `/ops/ingest/presign` | Ingress | Canonical ingest presign route exists | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/ops/ingest/submit` | Ingress | Canonical ingest submit route exists | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/ops/products/batch` | Ingress | Batch product creation ingress is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |

## Parser Logic
| Parser Path | Expected Parse Contract | Evidence Artifact | Status |
|---|---|---|---|
| `parsePotgImage(...)` in Ops client | POTG upload sends base64 image to parser API | `endpoint-ingress-render-checklist.test.ts` (`ops page uses POTG parser`) | PASS |
| `parseScoreboardImage(...)` in Ops client | Scoreboard upload sends base64 image to parser API | `endpoint-ingress-render-checklist.test.ts` (`ops page uses scoreboard parser`) | PASS |
| `handleParsePotgImage(...)` in worker | Worker parser handler is present | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `handleScoreboardImageParse(...)` in worker | Worker parser handler is present | `endpoint-ingress-render-checklist.test.ts` | PASS |

## Render Endpoints
| Route | Surface | Expected Render Source | Evidence Artifact | Status |
|---|---|---|---|---|
| `/api/public/media` | Media page | Published media feed source; no mock fallback | `endpoint-ingress-render-checklist.test.ts` + `worker-ingest-pipeline.test.ts` | PASS |
| `/api/public/potg` | POTG cards | Public POTG stream route is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |
| `/api/public/schedule` | Schedule views | Public schedule route is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |
| `/api/scores` | Scoreboards | Public scores route is wired | `endpoint-ingress-render-checklist.test.ts` | PASS |

## Auto-Resize Guarantees
| Check | Expected Behavior | Evidence Artifact | Status |
|---|---|---|---|
| Store media resize | Store uploads resize to `800x800` | `endpoint-ingress-render-checklist.test.ts` + `Ops.tsx` string check | PASS |
| POTG resize target inference | POTG upload infers portrait/landscape before submit | `endpoint-ingress-render-checklist.test.ts` + `Ops.tsx` string check | PASS |
| Canonical cover dimensions | Portrait `560x747`; landscape `747x560` | `endpoint-ingress-render-checklist.test.ts` + `imageResize.ts` | PASS |
| Render container fit | Media cards constrained to `3:4` containers | `endpoint-ingress-render-checklist.test.ts` + `Media.tsx` | PASS |

## Env-System Separation
| Boundary | Requirement | Evidence Artifact | Status |
|---|---|---|---|
| Frontend Vite env | only `VITE_SUPABASE_*` keys in browser env | `env-system-separation-audit.test.ts` | PASS |
| Worker secret runtime | `SUPABASE_SERVICE_ROLE_KEY` stays in worker secrets | `env-system-separation-audit.test.ts` + `wrangler.jsonc` | PASS |
| No service-role in client SDK setup | browser client resolves publishable/anon only | `env-system-separation-audit.test.ts` + `src/lib/supabase/client.ts` | PASS |

## Signature
- Signed-By: APEX Codex
- Signature-Type: Deterministic static route/parser/render audit with test artifacts
- Signed-At: 2026-04-07T23:59:00Z
- Evidence-Index: `docs/quality/evidence/ingress-render-evidence-2026-04-07.json`
