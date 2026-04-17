<!-- Version: v1.0.0 | Date: 2026-04-17 | Status: Current -->
# Broadcast Overlay · Interactive Engagement · Sponsors · AI Digest · OBS

**Status**: shipped in v1.2.0 (2026-04-17).
**Owner**: Broadcast Platform.

This doc is the single reference for the five subsystems added on
2026-04-17 to close the investor-readiness gaps identified in the
research memo:

1. **Scoreboard overlay** — chromeless `/overlay/:gameId` route serving
   OBS as a browser source.
2. **Interactive engagement** — polls, predictions, trivia, watch
   parties, gamification leaderboard.
3. **Sponsor overlay** — in-stream sponsor bug with rotation, weight,
   and impression/click tracking.
4. **AI weekly digest** — narrative recap per league, cached per
   (league, week), with optional Groq LLM generation.
5. **OBS remote control** — command queue consumed by an on-site agent
   (`obs-agent`) that relays commands over OBS WebSocket.

---

## 1. Database schema

Single migration: `supabase/migrations/20260417100000_overlay_engagement_sponsor_digest.sql`.

Applied to `ezanilxygnpucwkwpsoc` on 2026-04-17 (verified: 10 tables
created, 17 games backfilled with overlay rows, 1 RPC, 1 trigger).

| Table | Purpose |
| --- | --- |
| `overlay_game_state` | One row per game. Period, clock, score, fouls, timeouts, possession, bonus, lower-third, sponsor-bug flag. Public read, admin write. |
| `sponsor_slots` | Sponsor assets (name, tagline, logo, colors, weight, league scope, start/end). |
| `sponsor_impressions` | Append-only impression + click log. |
| `engagement_polls` | Poll / prediction / trivia questions. jsonb options. Status: draft/open/locked/closed. |
| `engagement_poll_votes` | One row per (poll, user). Unique constraint enforces "one vote per user". |
| `gamification_points` | Append-only ledger; `get_gamification_leaderboard(p_limit)` is the top-N RPC. |
| `watch_parties` | Host-created rooms keyed by 6-char `join_code`. |
| `watch_party_members` | (party, user) with unique constraint. |
| `ai_weekly_digest` | Cached headline + summary + sections. Unique on `(league_id, week_start)`. |
| `obs_commands` | FIFO queue (pending/acked/failed) for the on-site agent. |

**RLS**: every new table enables RLS. Public pages read through the
Cloudflare Worker using the service-role key, mirroring the
`/api/public/*` pattern already in production.

**Trigger**: `trg_ensure_overlay_state` on `public.games` auto-creates
the overlay row on game insert so the `/overlay/:gameId` page never
404s on a fresh game.

**Admin roles** (matches live `app_role` enum): `super_admin`,
`league_admin`, `team_manager`, `media_operator`. No `ops_admin`
alias — the enum does not define one.

---

## 2. Worker routes

Added files:
- `src/worker/routes/overlay.ts`
- `src/worker/routes/engagement.ts`
- `src/worker/routes/sponsors.ts`
- `src/worker/routes/digest.ts`
- `src/worker/routes/obs.ts`

### 2.1 Overlay

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | `/api/public/overlay/:gameId`      | public | Live overlay state + active sponsor. `Cache-Control: no-store`. |
| POST | `/api/ops/overlay/:gameId/state`   | admin  | Arbitrary merge-patch of whitelisted fields. |
| POST | `/api/ops/overlay/:gameId/clock`   | admin  | `{action:'start'\|'stop'\|'set', seconds?}` |
| POST | `/api/ops/overlay/:gameId/score`   | admin  | `{side:'home'\|'away', delta?:-2\|-1\|1\|2\|3, set?}` |
| POST | `/api/ops/overlay/:gameId/foul`    | admin  | `{side, delta?:1\|-1, reset?}` — auto-flips `bonus_home/away` at ≥7 |
| POST | `/api/ops/overlay/:gameId/period`  | admin  | `{action:'next'\|'set', period?}` |
| POST | `/api/ops/overlay/:gameId/reset`   | admin  | Zero the scoreboard. |

Score/reset also **mirror** to `games.home_score` / `games.away_score`
so the Scores page stays in sync without an explicit fan-out.

### 2.2 Engagement

| Method | Path | Auth |
| --- | --- | --- |
| GET  | `/api/public/engagement/polls?gameId=…`         | public |
| GET  | `/api/public/engagement/polls/:id/results`      | public |
| GET  | `/api/public/engagement/leaderboard`            | public |
| POST | `/api/engagement/polls/:id/vote`                | fan    |
| GET  | `/api/engagement/me/points`                     | fan    |
| POST | `/api/engagement/watch-parties`                 | fan    |
| GET  | `/api/engagement/watch-parties?gameId=…`        | fan    |
| POST | `/api/engagement/watch-parties/:id/join`        | fan    |
| POST | `/api/engagement/watch-parties/join-by-code`    | fan    |
| POST | `/api/ops/engagement/polls`                     | admin  |
| POST | `/api/ops/engagement/polls/:id`                 | admin  |
| POST | `/api/ops/engagement/polls/:id/grade`           | admin  |

Grading awards `points_award` to every vote whose `option_id` equals
the poll's `correct_option_id`, inserts into `gamification_points`,
and closes the poll. Re-grading is idempotent (awards only once per
user).

### 2.3 Sponsors

| Method | Path | Auth |
| --- | --- | --- |
| GET  | `/api/public/sponsors?leagueId=…`   | public (edge-cached 30 s) |
| POST | `/api/public/sponsors/:id/track`    | public |
| GET  | `/api/ops/sponsors`                 | admin  |
| POST | `/api/ops/sponsors`                 | admin  |
| POST | `/api/ops/sponsors/:id`             | admin  |
| POST | `/api/ops/sponsors/:id/delete`      | admin  |

Sponsors rotate on the overlay in a 15-second slot based on
`floor(now / 15000) % count` — deterministic across viewers in a
given 15-s window, no server-side state required.

### 2.4 AI weekly digest

| Method | Path | Auth |
| --- | --- | --- |
| GET  | `/api/public/digest?league=SBBL`            | public (edge-cached 5 min) |
| POST | `/api/ops/digest/:leagueCode/regenerate`    | admin  |

Flow:
1. Resolve league code → league id.
2. If a row exists in `ai_weekly_digest` for the current ISO week,
   return it.
3. Otherwise: collect facts (games finalised, scoring/rebound/assist
   leaders via `player_game_stats` joined to games in the last 7 days).
4. If `GROQ_API_KEY` is configured, call
   `llama-3.3-70b-versatile` with a JSON-only prompt; otherwise use
   `renderFallbackDigest` to build a deterministic template. `model`
   column records which path was taken.
5. Upsert on `(league_id, week_start)`.

### 2.5 OBS control

The web ops console enqueues commands; the on-site `obs-agent` pulls
with `GET /api/ops/obs/commands/pending` and acknowledges with
`POST /api/ops/obs/commands/:id/ack`. Agent auth is a Bearer token
matching the `OBS_AGENT_TOKEN` worker secret — no Supabase session
needed. Valid command kinds:

```
scene_switch · source_visibility · filter_enable
start_stream · stop_stream · start_record · stop_record
set_text_source · refresh_browser_source
```

---

## 3. Frontend pages

| Path | Component | Shell |
| --- | --- | --- |
| `/overlay/:gameId`               | `src/pages/Overlay.tsx`         | Chromeless — transparent background, no header/drawer. |
| `/overlay-control/:gameId`       | `src/pages/OverlayControl.tsx`  | Admin shell (`RequireAdmin`). |
| `/engage`                        | `src/pages/Engage.tsx`          | App shell. |
| `/digest`                        | `src/pages/Digest.tsx`          | App shell. |

`ShellSelector` in `src/App.tsx` routes `/overlay/*` through
`ChromelessShell` (no Header/BagDrawer/toast/marketing widgets) so
OBS's browser source never sees site chrome.

API clients:

- `src/lib/api/overlay.ts`
- `src/lib/api/engagement.ts`
- `src/lib/api/sponsors.ts`
- `src/lib/api/digest.ts`

---

## 4. OBS configuration

Add a browser source in OBS with:

- **URL**: `https://sbbl-hq.icu/overlay/<gameId>?theme=default`
- **Width**: 1920, **Height**: 1080
- **Custom CSS**: leave blank (the page paints its own transparent
  background).
- **Shutdown source when not visible**: off.
- **Refresh browser when scene becomes active**: optional.

Operators drive state via `/overlay-control/<gameId>` in a separate
browser tab. Changes appear in OBS within 1 s (the overlay polls
`/api/public/overlay/:gameId` every second and animates the clock
locally at 10 Hz between polls).

For full remote control, run `obs-agent` on the broadcast workstation
pointed at the worker with `OBS_AGENT_TOKEN` set on both sides.

---

## 5. Validation evidence (2026-04-17)

Executed via Supabase MCP against the production DB
(`ezanilxygnpucwkwpsoc`):

- ✅ 10 tables created, RLS enabled, policies in place.
- ✅ `get_gamification_leaderboard(10)` returned 2 correct voters at 15
  pts each after a 3-vote simulation.
- ✅ `trg_ensure_overlay_state` auto-created an overlay row on new game
  insert (verified + cleaned up).
- ✅ OBS command queue: pending → acked lifecycle works.
- ✅ Watch-party `(watch_party_id, user_id)` UNIQUE blocks duplicate
  joins.
- ✅ Score / foul / clock mutations propagate to
  `games.home_score` / `games.away_score`.

Frontend gates:

- ✅ `npm run typecheck` — clean.
- ✅ `npm run lint` — 0 errors, 0 warnings.
- ✅ `npm test` — 745 passed, 7 skipped. (+15 new tests in
  `src/test/worker-overlay-engagement-routes.test.ts`.)
- ✅ `npm run build` — succeeds; four new chunks emitted
  (`Overlay`, `OverlayControl`, `Engage`, `Digest`).

---

## 6. Known limitations

- **OBS agent** is not shipped in this repo — run the reference agent
  in `sbbl-hq-selfhost/` or write a 50-line Node script that polls
  `/pending` and dispatches to `obs-websocket`.
- **Engage write paths** require auth. Anonymous users see results
  but can't vote; this is intentional to keep the leaderboard honest.
- **Digest** uses current-week stats only; long-form season-wide
  reporting is out of scope for v1.
