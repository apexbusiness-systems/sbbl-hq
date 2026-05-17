# LiveStream Broadcast Event — Production Readiness Audit

**Date:** 2026-05-17  
**Branch:** `claude/livestream-broadcast-system-gxcDu`  
**Product:** SBBL HQ — Sunday's Best Basketball League super app

---

## Scope

First-class `livestream_broadcast_events` system:
- Admin create / edit / lifecycle management
- Public event index and detail pages
- Realtime status propagation via Supabase Postgres changes
- Worker API with URL validation and authorization
- Database migration with RLS

---

## Files Changed

| File | Type | Description |
|---|---|---|
| `supabase/migrations/20260517000100_livestream_broadcast_events.sql` | new | DB table, indexes, RLS, trigger |
| `src/worker/routes/broadcast-events.ts` | new | All 6 worker handlers |
| `src/worker/index.ts` | modified | Import + register 6 new routes |
| `src/types/index.ts` | modified | `LivestreamBroadcastEvent`, `BroadcastEventStatus`, `BroadcastEventVisibility` types |
| `src/lib/api/broadcast-events.ts` | new | Client-side API wrappers |
| `src/hooks/useBroadcastEventRealtime.ts` | new | Realtime hooks (detail + list) |
| `src/pages/BroadcastEvents.tsx` | new | Public index page |
| `src/pages/BroadcastEvent.tsx` | new | Public detail page |
| `src/components/ops/OpsBroadcastEventsTab.tsx` | new | Admin CRUD tab component |
| `src/pages/Ops.tsx` | modified | Added Broadcasts tab |
| `src/App.tsx` | modified | Added `/broadcasts` and `/broadcasts/:slug` routes |
| `src/test/broadcast-events.test.ts` | new | 41 unit tests |
| `docs/audits/livestream-production-readiness.md` | new | This document |

---

## Data Flow

```
Browser (public)
  → GET /api/public/broadcast-events[/:slug]
  → Worker handler (no auth required)
  → Supabase service-role query (RLS not bypassed — filter applied in handler)
  → Returns: status in (scheduled,live,ended,cancelled) AND visibility='public'
  → stream_url and embed_url redacted unless status='live'

Browser (realtime)
  → Supabase Realtime postgres_changes on livestream_broadcast_events
  → UPDATE events for the specific event id
  → React Query cache updated in-place (no refetch)

Admin (ops)
  → POST/PATCH/POST /api/ops/broadcast-events[/:id][/:id/status]
  → requireAuth(req) → requireAdminRole(admin, userId)
  → Supabase write via service-role client
  → Returns updated row
```

---

## Auth/RLS Review

**Database RLS:**
- `lbe_public_read`: SELECT only, status in `(scheduled,live,ended,cancelled)` AND `visibility='public'`. Drafts and archived are never readable by anon.
- `lbe_admin_all`: Full CRUD, gated on `user_role_assignments.role IN ('super_admin','league_admin')`. WITH CHECK clause mirrors USING clause — no privilege escalation.
- No public INSERT/UPDATE/DELETE policy exists.

**Worker auth:**
- Public handlers: no auth check. Worker applies the same status/visibility filter as RLS — belt-and-suspenders.
- Ops handlers: `requireAuth(req)` (throws 401 on missing `x-sbbl-user-id-verified`) then `requireAdminRole(admin, userId)` DB check (throws 403 on failure). Service-role key is Cloudflare secret — never reaches browser.

**No service-role key exposure:** `getAdminClient(env)` is called only inside worker handlers, never passed to or referenced from any browser code path.

---

## Public Surface Review

New public endpoints:
- `GET /api/public/broadcast-events` — list (cache: `s-maxage=15, max-age=10`)
- `GET /api/public/broadcast-events/:slug` — detail (cache: `s-maxage=10, max-age=5`)

Both endpoints:
- Require no authentication
- Filter on `status IN ('scheduled','live','ended','cancelled') AND visibility='public'`
- Redact `stream_url` and `embed_url` unless event is `live`
- Do not expose admin-only fields (created_by, updated_by are not selected on public routes)

No mock data: pages call real endpoints. Empty state rendered when array is empty.

---

## Realtime Review

- `useBroadcastEventRealtime(eventId, onUpdate)`: subscribes to `postgres_changes` UPDATE on `livestream_broadcast_events` filtered by `id=eq.<eventId>`. Updates React Query cache in-place. Cleans up channel on unmount or id change.
- `useBroadcastEventsListRealtime(onRefresh)`: subscribes to all `*` events on the table and calls `invalidateQueries` to refetch the list. Cleans up on unmount.
- Detail page additionally polls every 15 s when `status==='live'` so `stream_url` appears without a refresh if it propagates via the worker rather than realtime.
- No realtime subscription in the admin tab — admin fetches fresh on every mutation success.

---

## Cloudflare Runtime Impact

- 6 new routes added to the route table in `src/worker/index.ts`. Compiled lazily on first request — no startup cost.
- No new Cloudflare secrets required.
- No new KV/D1/R2 bindings required.
- New route file adds ~6 KB to the Worker bundle (well within 1 MB limit).
- Cache headers applied to public list/detail routes reduce Supabase read load.

---

## Environment Variables

No new environment variables required.

Required Cloudflare runtime values (unchanged):
- `NEXT_PUBLIC_SUPABASE_URL` = `https://supabase.sbbl-hq.icu`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<current runtime value>`
- `SUPABASE_SERVICE_ROLE_KEY` = Worker secret (unchanged)

---

## Tests Run

| Command | Result |
|---|---|
| `bun run typecheck` | Pre-existing `vitest/globals` TS error only — not introduced by this branch (confirmed by stash test) |
| `bun run lint` | Pre-existing `@eslint/js` package not installed — not introduced by this branch |
| `bun run test -- src/test/broadcast-events.test.ts` | **41/41 PASS** |
| `bun run build` | **✓ built in 9.83s** — no errors, 87 precache entries |

---

## Known Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Supabase Realtime `postgres_changes` requires the table to be in a Realtime publication. If not added, realtime will silently fail (no error, just no updates). | LOW | Page polls every 15s when live as fallback. List re-fetches on mutation success. |
| R2 | Slug uniqueness collision on high-frequency creates. | LOW | Handler retries once with a random suffix. Returns 409 on second collision. |
| R3 | `stream_url` gating relies on worker logic, not DB column. If worker is bypassed via direct Supabase access, draft events could expose URL. | LOW | RLS `lbe_public_read` only allows reads on `status IN (scheduled,live,ended,cancelled)`. Anon role cannot read drafts regardless. |

---

## Confirmed: No Infra Mutations

- **No Supabase secret rotation performed.**
- **No Cloudflare config changed.**
- **No Docker/Supabase self-host infra mutated.**
- **No `.env` files modified.**
- **Existing auth, REST, Realtime, and stream systems untouched.**

---

## Rollback Plan

1. **Revert code:** `git revert` the commit on this branch, or `git checkout main -- src/` to restore files.
2. **Revert DB migration:** Drop the table (no FK dependencies from other tables reference `livestream_broadcast_events`):
   ```sql
   DROP TABLE IF EXISTS public.livestream_broadcast_events CASCADE;
   ```
3. **Remove routes from App.tsx:** Delete `/broadcasts` and `/broadcasts/:slug` `<Route>` entries.
4. **Remove nav link** if added to Header (not added in this PR — no nav change made).
5. **Confirm existing systems:** `GET /api/broadcast/access`, `POST /api/broadcast/session`, `GET /api/public/broadcast-events` removed (404), all other routes unaffected.
6. **Smoke test:** `bun run build` green, existing E2E passing.

---

## Go/No-Go Decision

**GO** — with one manual follow-up action:

The migration `20260517000100_livestream_broadcast_events.sql` must be applied to the Supabase instance at `https://supabase.sbbl-hq.icu` before the Worker deployment is promoted to production. The Worker will handle missing-table gracefully (returns 500 with `query_failed`) until the migration runs, so the deploy order is:

1. Apply migration → 2. Deploy Worker → 3. Deploy frontend.

**Manual follow-up:**
- Add `livestream_broadcast_events` to the Supabase Realtime publication if realtime status updates are required (not mandatory — polling fallback is in place).
- Add a `/broadcasts` nav link to `Header.tsx` when the operator is ready to promote the feature publicly.
