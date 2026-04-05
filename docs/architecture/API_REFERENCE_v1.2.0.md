<!-- Version: v1.2.0 | Date: 2026-04-05 | Status: Current -->
# SBBL Worker API Reference

**Version:** v1.2.0
**Previous:** v1.1.0 (2026-04-04)
**Last Updated:** 2026-04-05

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

### Streams (Authenticated)
- `GET /api/streams/:gameId/access` — Check user's stream access.
- `POST /api/streams/:gameId/purchase` — Create Stripe PPV checkout. Turnstile-protected.
- `POST /api/streams/:gameId/session` — Create secure playback session. Returns `{ playback: { url, expiresAt, heartbeatIntervalSec }, session: { id, gameId } }`.
- `POST /api/streams/:gameId/session/heartbeat` — Keep session alive. TTL: 70s.
- `POST /api/streams/:gameId/session/end` — Teardown session.
- `GET /api/streams/:gameId/comments` — Recent chat messages.
- `POST /api/streams/:gameId/comments` — Post chat message. Rate-limited (10/user/30s, 20/IP/30s).
- `POST /api/streams/:gameId/react` — Post reaction (fire/heart/clap).

### Invites
- `POST /api/invite/generate` — Generate single-use fan invite. Eligible: player, paid_fan, super_admin.
- `POST /api/invite/redeem` — Redeem invite code. IP-locked, 24h expiry. Turnstile-protected.

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
