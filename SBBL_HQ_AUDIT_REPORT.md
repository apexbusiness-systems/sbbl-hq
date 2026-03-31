# SBBL HQ: Full Production-Readiness Audit and Remediation Plan

## 1. Release Verdict
**Verdict: NO. The application is unequivocally NOT releasable today.**
**Reasons:**
1. **Critical Admin CRUD Missing:** The Admin/Ops panel completely lacks `Edit` and `Delete` functionality for all core entities (Teams, Players, Schedules, Events, Media). If a CSV import has a typo or a POTG is parsed incorrectly, there is no way to fix or remove it via the UI.
2. **Heavy Reliance on Mock Data in Production Paths:** Seven major pages (`Home`, `Live`, `Stats`, `Leaderboards`, `Profiles`, `Store`, `Media`) import hardcoded data from `src/data/mock.ts` and use it as a fallback when the backend returns empty or fails. The `Live` page is 100% mocked, including video streams and chat interactions.
3. **Disconnected Backend Logic:** Critical operational queues (e.g., `/ops/review`, `/ops/publish-jobs`, `/ops/streams`, `/ops/revenue`, `/ops/headshots`) map to a single `handleOps` handler in `src/worker/index.ts` that returns a hardcoded fake queue array.
4. **Fragile AI Integration:** The Groq LLaMA 3.2 Vision image parser is wired, but it relies on a brittle Regex match to extract JSON from the LLM's raw text response rather than enforcing a JSON object response format.

## 2. Severity-Ranked Blockers
1. **Critical:** Missing Admin Edit/Delete functionality (Frontend & Backend). You cannot manage a real sports league without the ability to correct data errors.
2. **Critical:** `src/data/mock.ts` is deeply embedded in public pages. Empty states must be handled gracefully rather than presenting fake players, games, and e-commerce products.
3. **Critical:** The `Live` page is entirely fake. It pulls a "live" game and chat comments from mock data with no connection to the real `stream_sessions` or `stream_sources` DB tables.
4. **High:** The `handleOps` API endpoint is a stub returning a fake array. Admin review workflows are visual illusions.
5. **High:** The Groq Image Parser lacks `response_format: { type: 'json_object' }`, meaning the LLM can hallucinate conversational text that breaks the regex JSON parser.

## 3. Feature/Page Audit Table
| Feature | Expected Behavior | Actual Behavior | Data Source | Backend Dependency | Status | Root Cause / Evidence |
|---|---|---|---|---|---|---|
| **Home** | Show real active games/players | Shows mock `playersOfTheGame` | `mock.ts` fallback | `/api/public/home` | **Partially Working / Mocked** | Fallback in `Home.tsx` uses mock data. |
| **Teams** | List real teams, filter by league | Works, but no CRUD to manage them | DB (`fetchTeams`) | `/api/teams` | **Working** | Tested and verified via E2E. |
| **Leaderboards**| Show live DB rankings | Shows mock `mockPlayers` | API + `mock.ts` | `/api/leaderboards` | **Partially Working / Mocked** | Uses mock data if DB is empty. |
| **Live** | Stream real live games/chat | Shows fake game and fake chat | `mock.ts` | None wired | **Broken / Mocked** | `Live.tsx` hardcodes chat and `games.find()`. |
| **Media** | Display uploaded media assets | Shows mock `mockMediaAssets` | API + `mock.ts` | `/api/public/media` | **Partially Working / Mocked** | Uses mock data if API data is empty. |
| **Ops (Admin)** | Full CSV/Media/POTG management | Uploads work, Edit/Delete missing | Forms | Worker API | **Incomplete** | `Ops.tsx` missing UI buttons; worker missing `DELETE`/`PUT` endpoints. |
| **Store** | Buy real products | Shows mock `mockProducts` | API + `mock.ts` | `/api/public/products`| **Partially Working / Mocked** | Uses mock data if API data is empty. |
| **Settings** | User profile/auth management | Works | Supabase Auth | Supabase | **Working** | Local state and Auth context wired correctly. |

## 4. Admin CRUD Audit
- **Missing Edit Actions:** UI and Backend routes are missing for editing Teams, Players, Schedules, Events, Store Media, and POTG records.
- **Missing Delete Actions:** UI and Backend routes are missing for deleting Teams, Players, Schedules, Events, Store Media, and POTG records.
- **Missing Backend Handlers:** `src/worker/index.ts` has no `PUT`, `PATCH`, or `DELETE` methods for any entity except `cart-item-delete`.
- **Fake CRUD:** The `/ops/review`, `/ops/streams`, `/ops/publish-jobs` routes all point to `handleOps`, which returns:
  `{ queue: [{ type: 'source_conflict', league: 'WBL', status: 'pending' }, ...] }`. This is UI state illusion without DB persistence.

## 5. Upload Flow Audit
- **Status:** Partially Working.
- **Evidence:** `handleStoreMedia` successfully inserts into `products` and `media_assets` and uploads to Supabase Storage via `supabase.storage.from('media').upload()`. CSV imports (`submitCsvImport`) write to the DB.
- **Flaws:** POTG Upload does not validate the image properly before sending to Groq. The lack of idempotency keys on the POTG parsing flow means retries could duplicate requests.

## 6. Image Parser / OCR Audit
- **Status:** Implemented but Fragile.
- **Service:** Groq (`llama-3.2-11b-vision-preview`).
- **Flow:** Image uploaded -> Base64 -> Groq -> Regex match for JSON -> Populates UI -> User confirms -> Submits to DB.
- **Where it breaks:** The prompt asks for "ONLY a JSON object", but does not enforce it using the Groq API's `response_format`. The code `raw.match(/\{[\s\S]*\}/)` will fail if the model outputs markdown code blocks like ` ```json { ... } ``` `.
- **Fix Required:** Add `response_format: { type: "json_object" }` to the payload and adjust the system prompt to guarantee a strictly parsable JSON string.

## 7. Backend/Database/Policy Audit
- **Tables:** Exist according to `DB_SCHEMA.md` and migrations.
- **Missing CRUD:** No backend support for admin updates or deletes.
- **RLS Policies:** Exist for reading (`profiles_public_read`), but we lack evidence of robust row-level security blocking unauthorized mutation of `products` or `games` directly.
- **Orphan UI Actions:** The "Review Queue" in the ops dashboard calls endpoints that are completely stubbed out.

## 8. Mock Purge Report
All of the following files import from `src/data/mock.ts` and MUST be purged. They present fake success states that mask broken or empty backend tables.
1. `src/pages/Live.tsx`: Hardcoded game and chat arrays. **Blocks release.** Must wire to `stream_sessions` and real-time Supabase chat.
2. `src/pages/Home.tsx`: `playersOfTheGame`. **Blocks release.** Must return empty state if no POTG exists.
3. `src/pages/Leaderboards.tsx`: `mockPlayers`. **Blocks release.**
4. `src/pages/Stats.tsx`: `mockPlayers`. **Blocks release.**
5. `src/pages/Profiles.tsx`: `mockTeams`. **Blocks release.**
6. `src/pages/Store.tsx`: `mockProducts`. **Blocks release.**
7. `src/pages/Media.tsx`: `mockMediaAssets`. **Blocks release.**

## 9. Proven Working Flows
- User Authentication (Supabase Auth).
- League Context Switching (`LEAGUE_REGISTRY`).
- Public API reads (Config, Teams, Home).
- CSV Imports (Inserts rows into Postgres).
- Media Uploads (to Supabase Storage).

## 10. Broken or Unproven Flows
- **Live Streaming:** Disconnected visual shell.
- **Admin Record Editing/Deletion:** Non-existent.
- **Ops Review Pipeline:** Stubbed backend.
- **POTG OCR:** Brittle parsing logic.
- **Stripe Checkout:** End-to-end webhook validation is mocked in `handleStripeWebhook`.

## 11. Exact Remediation Plan (Priority Order)
1. **Purge Mocks:** Remove all `mock.ts` imports from the `src/pages` directory. Implement standard "No data found" empty states.
2. **Build Admin Delete/Edit APIs:** Add `PATCH /ops/entity/:table/:id` and `DELETE /ops/entity/:table/:id` to `src/worker/index.ts`.
3. **Build Admin Edit/Delete UI:** Add edit modals and delete confirmation dialogs to `src/pages/Ops.tsx`.
4. **Fix Image Parser:** Update Groq API call to enforce JSON output.
5. **Connect Ops Review:** Replace the stubbed `handleOps` with real queries to the `review_queue` table.
6. **Wire Live Page:** Connect `Live.tsx` to `stream_sessions` table and use Supabase Realtime for chat.

## 12. Code-Level Fixes

### A. Image Parser Fix (`src/worker/index.ts`)
```typescript
<<<<<<< SEARCH
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      max_tokens: 256,
      messages: [{
=======
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [{
>>>>>>> REPLACE
```

### B. Admin Delete API (`src/worker/index.ts`)
Add to routes:
```typescript
  { method: 'DELETE', path: '/ops/:table/:id', handler: handleOpsDelete },
```
Implement handler:
```typescript
async function handleOpsDelete(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const allowedTables = ['teams', 'players', 'schedule_slots', 'league_events', 'products', 'media_assets'];
  const table = ctx.params.table;

  if (!allowedTables.includes(table)) return json({ ok: false, error: 'invalid_table' }, 400);

  const { error } = await ctx.admin.from(table).delete().eq('id', ctx.params.id);
  if (error) throw new Error(error.message);

  await ctx.admin.from('audit_logs').insert({
    actor_id: session.userId,
    action: `ops_delete_${table}`,
    ref_type: table,
    ref_id: ctx.params.id,
    idempotency_key: readIdempotencyKey(ctx.req.headers),
  });

  return json({ ok: true });
}
```

### C. Remove Stubbed Ops Data (`src/worker/index.ts`)
```typescript
<<<<<<< SEARCH
  return json({
    ok: true,
    userId,
    queue: [
      { type: 'source_conflict', league: 'WBL', status: 'pending' },
      { type: 'rule_conflict', league: 'SBBL', status: 'pending' },
      { type: 'stream_risk', league: 'SBBL', status: 'warning' },
    ],
  });
=======
  const { data, error } = await ctx.admin.from('review_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return json({
    ok: true,
    userId,
    queue: data || [],
  });
>>>>>>> REPLACE
```

## 13. Production Release Checklist
- [ ] Mocks purged and deleted from `src/data/mock.ts`.
- [ ] Admin Edit/Delete buttons added to `Ops.tsx` data tables.
- [ ] Worker API handlers for Edit/Delete deployed.
- [ ] Groq JSON response format enforced.
- [ ] Live page hooked up to Supabase Realtime channel.
- [ ] Playwright E2E tests updated to assert empty states instead of mock data.
- [ ] Cloudflare deployment executed with real Stripe keys.
