# NarrateIQ — Build Task List
**Feature:** AI Narrative Engine (Section 5.11 — Standalone Checklist)  
**Date:** 2026-05-02  
**Est. Total Time:** ~3.5 hours  
**Branch:** claude/research-ai-developments-W5FeW  
**Decision:** BUILD NOW (see /output/apex-market-report.md Section 7)

---

## PRE-BUILD VALIDATION (DO FIRST — 20 min)

- [ ] Open console.groq.com/playground
- [ ] Select model: `llama-4-scout-17b-16e-instruct`
- [ ] Paste sample SBBL/WBL game stats JSON as prompt input
- [ ] Verify structured output matches expected `{ headline, recap, tickers[], social_caption }` shape
- [ ] **GATE:** If quality is unacceptable → abort and pivot to simpler GPT-OSS 20B model
- [ ] Confirm `GROQ_API_KEY` is active in Cloudflare Worker secrets (check wrangler dashboard)

---

## TASK 1 — Create DB Migration
**File:** `supabase/migrations/20260502000100_ai_narratives.sql`  
**Est. Time:** 15 min  
**Done When:** `supabase db push` succeeds without error

- [ ] Create `ai_narratives` table (schema in Section 5.4 of apex-market-report.md)
- [ ] Add indexes: `game_id`, `league_id`, `status`
- [ ] Enable RLS
- [ ] Add RLS policies: admin read/write + public read for approved/published
- [ ] Run `supabase db push` locally
- [ ] Verify table exists in Supabase dashboard

---

## TASK 2 — Create Groq Prompt Module
**File:** `src/worker/routes/ai-narrate.ts` (new file)  
**Est. Time:** 30 min  
**Done When:** Function returns valid Groq API request body with structured output schema

- [ ] Create file `src/worker/routes/ai-narrate.ts`
- [ ] Define `const MODEL_ID = 'meta-llama/llama-4-scout-17b-16e-instruct'`
- [ ] Define `const PROMPT_VERSION = 1`
- [ ] Implement `buildNarrativePrompt(statsData: GameStatsData): GroqRequest`
- [ ] Set `response_format: { type: 'json_object' }` in request
- [ ] Define TypeScript interface `NarrativeOutput { headline: string; recap: string; tickers: TickerLine[]; social_caption: string; }`
- [ ] Define `TickerLine { text: string; display_at_second?: number; }`

---

## TASK 3 — Build Stats Query
**File:** `src/worker/routes/ai-narrate.ts`  
**Est. Time:** 20 min  
**Done When:** Query returns all data needed to build prompt

- [ ] Write Supabase query joining: `player_game_stats` + `team_game_stats` + `players` + `teams` + `games` + `leagues`
- [ ] Filter by `game_id` parameter
- [ ] Require `status = 'finalized'` on `player_game_stats` — add preflight check
- [ ] Return early with `STATS_NOT_FINALIZED` error if stats not finalized
- [ ] Transform query result into `GameStatsData` shape for prompt builder

---

## TASK 4 — Build Groq Compound Call
**File:** `src/worker/routes/ai-narrate.ts`  
**Est. Time:** 20 min  
**Done When:** Call returns valid structured JSON

- [ ] Implement `callGroqNarrate(prompt: GroqRequest, env: Env): Promise<NarrativeOutput>`
- [ ] Use `fetch('https://api.groq.com/openai/v1/chat/completions', ...)`
- [ ] Set `Authorization: Bearer ${env.GROQ_API_KEY}`
- [ ] Set 10-second timeout via AbortController
- [ ] Validate response shape before returning (throw `GROQ_INVALID_RESPONSE` if malformed)
- [ ] On timeout: throw `GROQ_UNAVAILABLE` (admin retries manually — not a critical-path failure)

---

## TASK 5 — Wire OmniPort + DB Write
**File:** `src/worker/routes/ai-narrate.ts`  
**Est. Time:** 20 min  
**Done When:** Duplicate requests return existing draft; no double Groq calls

- [ ] Import `normalizeIngress` from `src/lib/omniport.ts`
- [ ] Wrap mutation in `normalizeIngress({ source_type: 'webhook', entity_type: 'narrative_request', ... })`
- [ ] Generate `idempotency_key = hash(game_id + prompt_version + actor_id)` using `crypto.subtle`
- [ ] Check `ai_narratives` for existing draft with same idempotency_key before calling Groq
- [ ] If exists: return existing draft immediately (idempotency satisfied)
- [ ] INSERT into `ai_narratives` with `status: 'draft'` and `raw_groq_response`
- [ ] INSERT into `omniport_outbox` (existing pattern)
- [ ] INSERT into `audit_logs` (existing pattern)

---

## TASK 6 — Register Route in Worker
**File:** `src/worker/index.ts`  
**Est. Time:** 10 min  
**Done When:** `npm run typecheck` passes clean

- [ ] Add to route table: `case 'POST /api/ai/narrate/:gameId': return aiNarrateRoute(req, env)`
- [ ] Add: `case 'PATCH /api/ai/narrate/:narrativeId/approve': return aiNarrateApprove(req, env)`
- [ ] Add: `case 'PATCH /api/ai/narrate/:narrativeId/reject': return aiNarrateReject(req, env)`
- [ ] Add: `case 'GET /api/ai/narratives/:gameId': return aiNarrativesList(req, env)`
- [ ] Import `aiNarrateRoute, aiNarrateApprove, aiNarrateReject, aiNarrativesList` at top of file
- [ ] Run `npm run typecheck` — must pass 0 errors

---

## TASK 7 — Add Approve / Reject Handlers
**File:** `src/worker/routes/ai-narrate.ts`  
**Est. Time:** 20 min  
**Done When:** Admin can transition draft → approved and draft → rejected

- [ ] Implement `aiNarrateApprove(req, env)`:
  - Require `league_admin+` role
  - Accept optional `edits: { headline?, recap?, tickers?, social_caption? }` body
  - UPDATE `ai_narratives SET status='approved', approved_by, approved_at, ...edits`
  - Log to `audit_logs`
  - POST to `OMNIHUB_SYNC_URL` with HMAC signature (existing pattern)
- [ ] Implement `aiNarrateReject(req, env)`:
  - UPDATE `ai_narratives SET status='rejected'`
  - Log to `audit_logs`
- [ ] Implement `aiNarrativesList(req, env)`:
  - Public: `status IN ('approved', 'published')`
  - Admin: all statuses
- [ ] Run `npm run typecheck` — must pass 0 errors

---

## TASK 8 — Update Ops Console UI
**File:** `src/pages/Ops.tsx`  
**Est. Time:** 30 min  
**Done When:** Admin can trigger generation + approve from Ops UI

- [ ] In Scores tab: add "Generate AI Recap" button (only shows after game finalized)
- [ ] Button calls `apiFetch('POST /api/ai/narrate/:gameId')` via `src/lib/api/ai.ts` (new client file)
- [ ] Create `src/lib/api/ai.ts` with `generateNarrative(gameId)`, `approveNarrative(narrativeId, edits?)`, `rejectNarrative(narrativeId)` functions
- [ ] Show loading state during Groq call (3-5s expected)
- [ ] On success: show preview modal with all 4 fields (headline, recap, tickers, social_caption)
- [ ] Modal: Approve button, Reject button, editable text fields for each section
- [ ] Social caption: clipboard copy button
- [ ] Run `npm run lint` — must pass 0 warnings

---

## TASK 9 — Update Digest Route
**File:** `src/worker/routes/digest.ts`  
**Est. Time:** 15 min  
**Done When:** `/digest` page shows AI-generated recap for approved games

- [ ] Add Supabase query: `SELECT * FROM ai_narratives WHERE status IN ('approved','published') AND game_id = ANY($gameIds) ORDER BY approved_at DESC LIMIT 1 PER game_id`
- [ ] Include `narratives: AiNarrative[]` in GET `/api/digest` response
- [ ] Update `Digest.tsx` page to render `narrative.recap` section if present
- [ ] Graceful empty state: if no narrative, show existing digest content unchanged
- [ ] Run `npm run typecheck` — must pass 0 errors

---

## TASK 10 — Write Vitest Unit Tests
**Files:** `src/test/ai-narrate.test.ts`, `src/test/ai-narrate-prompt.test.ts`  
**Est. Time:** 30 min  
**Done When:** `npm test` passes with new tests included; lint and typecheck green

- [ ] Mock Groq API response (`vi.mock` or `vi.stubGlobal('fetch', ...)`)
- [ ] Test: `POST /api/ai/narrate/:gameId` with valid `league_admin` JWT → returns 200 with draft
- [ ] Test: Duplicate request (same idempotency_key) → returns existing draft, Groq NOT called twice
- [ ] Test: Non-admin JWT → returns 403
- [ ] Test: Game stats not finalized → returns `STATS_NOT_FINALIZED` error
- [ ] Test: Groq timeout → returns `GROQ_UNAVAILABLE` error (no crash)
- [ ] Test: Malformed Groq response → returns `GROQ_INVALID_RESPONSE` error
- [ ] Test prompt builder: `buildNarrativePrompt(mockStats)` returns valid Groq request body
- [ ] Run `npm test` → all tests pass
- [ ] Run `npm run lint` → 0 warnings
- [ ] Run `npm run typecheck` → 0 errors
- [ ] Run `npm run build` → production build succeeds

---

## POST-BUILD VALIDATION

- [ ] Deploy to staging: `npm run cf:deploy:staging`
- [ ] Run test narrative generation on last WBL game in staging
- [ ] Verify overlay ticker lines appear on `/overlay` page without layout regression
- [ ] Verify `/digest` page shows approved narrative
- [ ] Run full test suite: `npm test` all green
- [ ] Run E2E smoke test: `npx playwright test --project=chromium e2e/critical-paths.spec.ts`
- [ ] No CSP violations: `npx playwright test --project=chromium e2e/csp-invariant.spec.ts`
- [ ] Deploy to production: `npm run cf:deploy`

---

## 7-DAY REVENUE VALIDATION

- [ ] Day 1: First AI recap generated + approved on live WBL game
- [ ] Day 2: Recap published to SBBL social (screenshot the output)
- [ ] Day 3: Post to r/BasketballCoach + local Edmonton sports Facebook groups
- [ ] Day 4: Live overlay tickers enabled for TGIF game — zero player regressions
- [ ] Day 5: DM 5 amateur league admins with demo link + offer
- [ ] Day 6: First external league activates free trial
- [ ] Day 7: Confirm >80% admin approval rate on generated recaps

---

*Generated by APEX-POWER-20X Research Engine | SBBL-HQ v1.4.0 | 2026-05-02*
