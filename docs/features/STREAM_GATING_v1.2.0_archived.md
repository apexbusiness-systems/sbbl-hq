<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# Stream Gating

**Version:** v1.2.0
**Last Updated:** 2026-04-04

## PPV Entitlement Flow

1. **Purchase:** User clicks Buy → `POST /api/streams/:gameId/purchase` → Stripe Checkout session created.
2. **Webhook:** Stripe fires `checkout.session.completed` → Worker `POST /webhooks/stripe` (`src/worker/index.ts`) verifies HMAC-SHA256 signature → calls `create_stream_entitlement` RPC → 24h access window.
3. **Access check:** `can_user_view_stream(game_id, user_id)` RPC checks both `stream_entitlements` (Path A) and `ppv_invites` (Path B).
4. **Session:** `POST /api/streams/:gameId/session` creates `stream_access_sessions` row with short-lived playback descriptor.
5. **Heartbeat:** Client sends `POST /api/streams/:gameId/session/heartbeat` every ~25s.

## Invite-Based Access

- `ppv_invites` table: `id` (UUID) serves as the invite code. One invite per generator per game (`UNIQUE(generated_by, game_id)`).
- IP-locked on first redemption (`ip_address` column, enforced in worker).
- Invites expire 24h from creation (`expires_at`).
- Roles that can generate invites: `player` (premium), `paid_fan`, `super_admin`.

## Turnstile Protection

PPV purchase and invite redemption are protected by Cloudflare Turnstile:
- Client: `useTurnstile` hook resolves a fresh token before each protected request.
- Worker: `verifyTurnstileToken()` validates server-side when `OPTIONAL_TURNSTILE_SECRET_KEY` is configured.

## Stripe Webhook Idempotency

- `stripe_events` table with UNIQUE constraint on `stripe_event_id` (TEXT).
- Edge Function checks for duplicate before processing.
- Status tracking: `processed`, `duplicate`, `failed`, `skipped`.
- Error detail captured for replay audit.

## Live Chat

- `stream_chat_messages` table with moderation lifecycle: `active` → `hidden` → `removed`.
- Message length: 1–400 characters (DB constraint).
- `GET /api/streams/:gameId/comments` — recent active messages.
- `POST /api/streams/:gameId/comments` — authenticated, validated, rate-limited.

## Standings (Materialized View)

- `mvw_standings` pre-aggregates W/L/pts_for/pts_against/win_pct per `(league_id, season_id, team_id)`.
- Refreshed `CONCURRENTLY` by `trg_games_refresh_standings` trigger when game status transitions to `final`.
- Unique index `(league_id, season_id, team_id)` required for concurrent refresh.
- Public read via `GRANT SELECT TO anon, authenticated`.

## Stream Presence

- `stream_access_sessions` extended with `game_id`, `status`, `last_seen_at` columns (20260404090000).
- Viewer count: `COUNT(DISTINCT user_id)` where `status='active' AND expires_at > now()`, scoped by `game_id`.
- `stream_sessions` extended with `peak_viewers`, `current_viewers`, `started_at`, `ended_at`.

## Performance Indexes

Hot-path indexes for 10K+ concurrent viewers:
- `stream_entitlements(user_id, game_id, status)` — every access check
- `stream_entitlements(expires_at) WHERE status='active'` — expiry queries
- `stream_access_sessions(user_id, expires_at)` — heartbeat checks
- `stream_access_sessions(game_id, status, expires_at)` — viewer counting
- `stream_reactions(game_id, created_at DESC)` — live event volume
- `stream_chat_messages(game_id, status, created_at DESC)` — chat room queries
