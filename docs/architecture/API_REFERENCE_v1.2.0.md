<!-- Version: v1.3.0 | Date: 2026-05-06 | Status: Current -->
# SBBL Worker API Reference

**Version:** v1.3.0
**Previous:** v1.2.0 (2026-04-05)
**Last Updated:** 2026-05-06

**Changelog (v1.2.0 → v1.3.0):**
- Added **Broadcast** section documenting the `/api/broadcast/*` route
  family (open-broadcast access, session, heartbeat, end). These routes
  are independent of games and PPV — see CLAUDE.md Rule 7 and
  `BROADCAST_PAYWALL_SYSTEM.md §10` for the freeze policy.
- Clarified that `/api/streams/:gameId/*` is PPV/game-specific only.
  The `'broadcast'` gameId alias is rejected by `handlePlaybackSession`
  with `400 use_broadcast_endpoint` as of v1.3.0.

Base: Worker routes in `src/worker/index.ts`.

## Authentication

### Auth source
- **JWT only:** `Authorization: Bearer <supabase_jwt>`.
- Worker verifies JWT via Supabase JWKS endpoint (`jwtVerify` with `jose`).
- On success, sets internal `x-sbbl-user-id-verified` header (never trust client-supplied headers).
- **No fallback:** client-supplied `x-sbbl-user-id` and `x-sbbl-roles` headers are stripped before processing (v1.2.0).

### Client-side auth
- `apiFetch()` auto-fetches a fresh JWT via `getAuthToken()` which calls `supabase.auth.getUser()` (triggers token refresh if expired).
- On 401, `apiFetch` refreshes the session and retries exactly once, regardless of whether the token was explicit or auto-fetched.
- **Best practice:** pass `null` as the token parameter to let `apiFetch` handle auth automatically.

### Idempotency
All mutating methods (`POST/PUT/PATCH/DELETE`) require a valid idempotency key via `x-idempotency-key` header. `apiFetch` auto-generates keys for all mutations.

## Endpoints

### Public (No Auth Required)
- `GET /api/public-config` — Runtime config bootstrap `{ supabaseUrl, supabasePublishableKey, appName, defaultLeague }`.
- `GET /api/public/home?league=<code>` — Aggregated home page data.
- `GET /api/public/schedule?league=<code>` — Public schedule.
- `GET /api/public/potg?league=<code>` — Player of the Game feed.
- `GET /api/teams` — Public team list with roster names.
- `GET /api/scores` — Public scores with filtering.
- `GET /api/streams/status?gameId=<id>` — Public stream state `{ isLive, title, viewerCount, gameId }`. No playback URL. Edge-cached (10s TTL).
- `GET /api/streams/:gameId/reactions` — Reaction counts.
- `GET /api/public/overlay/:gameId` — Live scoreboard overlay state + active sponsor. `Cache-Control: no-store` (live state). Consumed by `/overlay/:gameId` chromeless OBS page.
- `GET /api/public/engagement/polls?gameId=<id>` — Open/locked/closed polls, predictions, trivia.
- `GET /api/public/engagement/polls/:id/results` — Live vote tallies per option.
- `GET /api/public/engagement/leaderboard` — Top 25 fans by gamification points (via `get_gamification_leaderboard`).
- `GET /api/public/sponsors?leagueId=<uuid>` — Active sponsors (edge-cached 30 s).
- `POST /api/public/sponsors/:id/track` — Record `impression` or `click` (fire-and-forget).
- `GET /api/public/digest?league=<code>` — AI-generated weekly recap. Cached per `(league, week_start)`; falls back to deterministic template when `GROQ_API_KEY` is absent. Edge-cached 5 min.

### Session & Profile
- `GET /auth/session` — `{ ok, userId, roles }` or `401`.
- `GET /api/profile/me` — `{ id, profileStatus, roles }`.
- `POST /api/profile/onboarding` — Save onboarding data.
- `POST /api/profile/headshot` — Upload/update headshot.

### Games & Stats
- `GET /api/games/:id/stat-sheet` — Game stat sheet.
- `POST /api/games/:id/stats/draft` — Save stat draft (RPC `save_stat_draft`).
- `POST /api/games/:id/stats/finalize` — Finalize game stats (RPC `finalize_game_stats`).
- `GET /api/stats` — Stats dashboard (RPC `get_stats_dashboard`).
- `GET /api/leaderboards` — Leaderboards (RPC `get_leaderboards`).

### Broadcast — Open Broadcast (Authenticated, FROZEN — see CLAUDE.md Rule 7)

These routes own the open-broadcast path. They have zero game coupling.
Access requirement: `onboarding_completed_at IS NOT NULL` (completed fan
onboarding). No PPV, no entitlement rows, no `can_user_view_stream`.

- `GET /api/broadcast/access` — `{ ok, hasAccess: boolean }`. Returns
  `hasAccess=false` when stream is offline regardless of registration status.
- `POST /api/broadcast/session` — Start or refresh a broadcast viewing session.
  Body: `{ sessionKey: string (≥8 chars) }`.
  Returns: `{ ok, playback: { url, type, heartbeatIntervalSec, maxExpiresAt }, session: { id, maxExpiresAt } }`.
  Super admins bypass all checks and get the URL even when `is_live=false`.
  One-device enforcement: a new session displaces the previous active session
  for the same user; the displaced device's next heartbeat gets `session_not_found`.
- `POST /api/broadcast/session/heartbeat` — Extend session TTL. Body: `{ sessionId }`.
  Returns: `{ ok, expiresAt }`. Returns `404 session_not_found` if session is
  missing, expired, or displaced.
- `POST /api/broadcast/session/end` — Teardown session. Body: `{ sessionId }`.

> **Do NOT add `game_id`, PPV, or entitlement logic to these routes.**
> See `BROADCAST_PAYWALL_SYSTEM.md §10` and `STREAM_INDEPENDENCE_CONTRACT.md §7`.

### Streams — PPV / Game-Specific (Authenticated)

`:gameId` must be a real UUID from the `games` table. Passing `'broadcast'`
or omitting gameId returns `400 use_broadcast_endpoint` — use `/api/broadcast/*`.

- `GET /api/streams/:gameId/access` — Check PPV entitlement for a game.
  Returns `{ ok, hasAccess: boolean }` via `can_user_view_stream` RPC.
- `POST /api/streams/:gameId/purchase` — Create Stripe PPV checkout. Turnstile-protected.
- `POST /api/streams/:gameId/session` — Create secure playback session for a PPV game.
  Returns `{ playback: { url, expiresAt, heartbeatIntervalSec }, session: { id, gameId } }`.
- `POST /api/streams/:gameId/session/heartbeat` — Keep session alive. TTL: 70s.
- `POST /api/streams/:gameId/session/end` — Teardown session.
- `GET /api/streams/:gameId/comments` — Recent chat messages.
- `POST /api/streams/:gameId/comments` — Post chat message. Rate-limited (10/user/30s, 20/IP/30s).
- `POST /api/streams/:gameId/react` — Post reaction (fire/heart/clap).
- `GET /api/streams/:gameId/replay/status` — Replay availability, embargo state, and price.

### Invites
- `POST /api/invite/generate` — Generate single-use fan invite. Eligible: player, paid_fan, super_admin.
- `POST /api/invite/redeem` — Redeem invite code. IP-locked, 48h default expiry (canonical `ENTITLEMENT.MANUAL_COMP_VALIDITY_HOURS`, clamped `[1,168]`). Turnstile-protected.

### Commerce
- `GET /api/cart` — User's cart.
- `POST /api/cart/items` — Add to cart.
- `DELETE /api/cart/items/:itemId` — Remove from cart.
- `POST /api/store/checkout` — Store checkout → Stripe.
- `POST /api/player/checkout` — Player registration checkout → Stripe.

### Operations (role-gated)

Require `league_admin`, `super_admin`, or `team_manager` role.

- `GET /ops/streams/config` — Full stream config (league_admin+). Returns `{ collectionId, title, source, isLive, viewerCount, updatedAt, gameId }`.
- `POST /ops/streams/config` — Update stream config (super_admin). Saves URL, title, source.
- `POST /ops/streams/status` — Go live / end broadcast (super_admin). Emergency kill switch.
- `GET /ops/streams/sessions` — Broadcast session history.
- `GET /ops/access/lookup?email=<email>` — Lookup user's stream access status (super_admin).
- `POST /ops/access/override` — Grant/revoke manual PPV access (super_admin).
- `GET /ops/review` — Review queue.
- `POST /ops/review/:id/resolve` — Resolve review item.
- `GET /ops/revenue` — PPV revenue snapshot.
- `GET /ops/publish-jobs` — Publishing job status.
- `GET /ops/headshots` — Headshot moderation queue.
- `POST /ops/imports/:kind` — CSV import (teams, players, schedules, events).
- `GET /ops/imports/history` — Import job history.
- `POST /ops/store/media` — Upload store media.
- `POST /ops/potg/parse` — Parse POTG image with AI.
- `POST /ops/potg/submit` — Submit POTG record.
- `POST /api/coach/request` — Coach approval request.
- `GET /ops/coach/requests` — List coach requests.
- `POST /ops/coach/:id/resolve` — Resolve coach request.
- `POST /api/ops/overlay/:gameId/{state,clock,score,foul,period,reset}` — Scoreboard overlay mutations (super_admin / league_admin / team_manager / media_operator). Score/reset mirror to `games.home_score` / `games.away_score`.
- `POST /api/ops/engagement/polls` — Create poll/prediction/trivia. `POST /api/ops/engagement/polls/:id` updates status/correct option. `POST /api/ops/engagement/polls/:id/grade` awards points idempotently.
- `GET /api/ops/sponsors` · `POST /api/ops/sponsors` · `POST /api/ops/sponsors/:id` · `POST /api/ops/sponsors/:id/delete` — Sponsor CRUD (super_admin / league_admin).
- `POST /api/ops/obs/commands` · `GET /api/ops/obs/commands` — Enqueue / list OBS commands (super_admin / league_admin / media_operator).
- `GET /api/ops/obs/commands/pending` · `POST /api/ops/obs/commands/:id/ack` — On-site `obs-agent` endpoints, auth'd by `Bearer $OBS_AGENT_TOKEN` (not Supabase JWT).
- `POST /api/ops/digest/:leagueCode/regenerate` — Force-rebuild weekly digest (super_admin / league_admin / media_operator).

Authenticated fan endpoints (non-admin):
- `POST /api/engagement/polls/:id/vote` — One vote per (poll, user) enforced by unique constraint.
- `GET /api/engagement/me/points` — Personal points + award history.
- `POST /api/engagement/watch-parties` · `GET /api/engagement/watch-parties?gameId=<id>` · `POST /api/engagement/watch-parties/:id/join` · `POST /api/engagement/watch-parties/join-by-code` — Watch-party lifecycle.

### Webhooks
- `POST /webhooks/stripe` — Stripe webhook (HMAC-SHA256 verified).

### Sync
- `POST /api/ingress` — OmniHub ingress.
- `POST /sync/drain` — Sync drain.

## Error Model

| Status | Meaning |
|---|---|
| `401` | Unauthorized — JWT missing or invalid |
| `403` | Forbidden — role insufficient |
| `400` | Bad request — invalid/missing idempotency key, invalid body |
| `404` | Route not found |
| `429` | Rate limited |
| `500` | Internal error (reported to Sentry) |
| `503` | Stream not configured (no URL set) |

Error shape: `{ "ok": false, "error": "<message>" }`
