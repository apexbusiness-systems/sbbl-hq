# SBBL Worker API Reference

Base: Worker routes in `src/worker/index.ts`.

## Authentication

### Auth sources
- Preferred: `Authorization: Bearer <supabase_jwt>`.
- Fallback/internal: `x-sbbl-user-id` header.
- Role header: `x-sbbl-roles: role1,role2`.

### Idempotency
All mutating methods (`POST/PUT/PATCH/DELETE`) require a valid idempotency key parsed by `readIdempotencyKey(headers)`.

## Endpoints

### Public (No Auth Required)
- `GET /api/public-config`
  - Response: `{ supabaseUrl, supabasePublishableKey, appName, defaultLeague }`.
  - Purpose: Runtime config bootstrap for frontend — avoids baking env vars into client bundle.
- `GET /api/public/home?league=<code>`
  - Query: `league` — league code (e.g. `sbbl`, `wbl`, `tgifbl`). Defaults to `sbbl`.
  - Response: `{ ok, league, season, teams[], totalTeams, totalRostered, liveGames[], upcomingGames[], recentGames[], totalGames, leagues[] }`.
  - Purpose: Aggregated home page data for unauthenticated visitors.

### Session & Profile
- `GET /auth/session`
  - Response: `{ ok, userId, roles }` or `401 unauthorized`.
- `GET /api/profile/me`
  - Response: `{ id, profileStatus, roles }`.
- `POST /api/profile/onboarding`
  - Mutation-ack envelope.
- `POST /api/profile/headshot`
  - Mutation-ack envelope.

### Games & Stats
- `GET /api/games/:id/stat-sheet`
  - Mutation-ack envelope with `gameId` path param returned in `params`.
- `POST /api/games/:id/stats/draft`
  - Body: arbitrary JSON payload.
  - Action: RPC `save_stat_draft` with `{ p_game_id, p_payload, p_idempotency_key }`.
  - Response: `{ ok, userId, gameId, status: "draft_saved" }`.
- `POST /api/games/:id/stats/finalize`
  - Body: arbitrary JSON payload.
  - Action: RPC `finalize_game_stats` with `{ p_game_id, p_payload, p_idempotency_key }`.
  - Response: `{ ok, userId, gameId, status: "finalized" }`.
- `GET /api/stats`
  - Query params forwarded as `p_filters` object to RPC `get_stats_dashboard`.
- `GET /api/leaderboards`
  - Query params forwarded as `p_filters` object to RPC `get_leaderboards`.

### Streams
- `GET /api/streams/:gameId/preview`
- `POST /api/streams/:gameId/purchase`
- `GET /api/streams/:gameId/access`
- `POST /api/streams/:gameId/session`

All above currently return mutation-ack envelopes.

### Commerce
- `GET /api/cart`
- `POST /api/cart/items`
- `POST /api/orders`
- `POST /api/orders/:id/pay`
- `GET /api/billing/history`
- `POST /api/rewards/redeem`

All above currently return mutation-ack envelopes.

### Operations (role-gated)
- `GET /ops/review`
- `POST /ops/review/:id/resolve`
- `GET /ops/streams`
- `GET /ops/publish-jobs`
- `GET /ops/revenue`
- `GET /ops/headshots`

Authorization: denied with `403 forbidden` unless `canAccessOps(roles)` returns true.

### Webhooks
- `POST /webhooks/stripe`
  - Current behavior: mutation-ack envelope.

## Error Model
- `401`: unauthorized
- `403`: forbidden
- `400`: missing/invalid/duplicate idempotency key
- `404`: route not found
- `500`: internal error or server misconfiguration

Error shape:
```json
{ "ok": false, "error": "<message>" }
```

## Environment Variables
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (optional)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `OPTIONAL_SOCIAL_API_KEYS` (optional)
- `OPTIONAL_TURNSTILE_SECRET_KEY` (optional)

## Compliance Endpoints Status
The following endpoints are required by platform policy but are not currently present in the Worker route table:
- export user data
- delete user data
