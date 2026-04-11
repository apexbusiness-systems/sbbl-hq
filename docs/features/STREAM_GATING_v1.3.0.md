<!-- Version: v1.3.0 | Date: 2026-04-05 | Status: Current -->
# Stream Gating

**Version:** v1.3.0
**Previous:** v1.2.0 (2026-04-04)
**Last Updated:** 2026-04-05

## Changelog (v1.3.0)

- **Auth auto-refresh:** All stream API calls (session, heartbeat, purchase, invite, chat) use `apiFetch` with auto-refreshing auth. No explicit `token` prop is passed from React closures — eliminates stale-token 401 loops.
- **`token` prop removed from `LiveStreamPlayer`:** Component no longer accepts or uses an explicit auth token. All auth is handled internally by `apiFetch → getAuthToken()`.
- **Heartbeat circuit breaker:** After 3 consecutive heartbeat failures, the interval stops (battery-safe) and a "Connection lost" banner appears with a Reconnect button.
- **ReactPlayer error handling:** `onError` → "Stream Unavailable" with Retry button. `onReady` → loading spinner until stream connects. `onBuffer` → marks player ready.
- **Single admin control surface:** Stream management moved to a gear-icon overlay dropdown on the video wrapper. Ops console streams tab removed entirely.
- **No-game fallback:** When admin goes live without a scheduled game, viewers see the stream via a synthetic game shell. When truly offline with no games, shows "No Active Broadcast."

---

## PPV Entitlement Flow

1. **Purchase:** User clicks Buy → `POST /api/streams/:gameId/purchase` → Stripe Checkout session created.
2. **Webhook:** Stripe fires `checkout.session.completed` → Worker `POST /webhooks/stripe` verifies HMAC-SHA256 → calls `create_stream_entitlement` RPC → 24h access window.
3. **Access check:** `can_user_view_stream(game_id, user_id)` RPC checks both `stream_entitlements` (Path A) and `ppv_invites` (Path B).
4. **Session:** `POST /api/streams/:gameId/session` creates `stream_access_sessions` row with playback URL + session ID.
5. **Heartbeat:** Client sends `POST /api/streams/:gameId/session/heartbeat` every ~25s. Circuit breaker stops after 3 consecutive failures.
6. **Teardown:** `POST /api/streams/:gameId/session/end` on component unmount.

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
- Rate limits: 10 messages per user per 30s, 20 messages per IP per 30s.
- `GET /api/streams/:gameId/comments` — recent active messages.
- `POST /api/streams/:gameId/comments` — authenticated, validated, rate-limited.

## Stream Presence

- `stream_access_sessions` tracks active viewers with `game_id`, `status`, `last_seen_at`, `expires_at`.
- Session TTL: 70 seconds. Heartbeat interval: 25 seconds. Grace: ~2 missed heartbeats before expiry.
- Viewer count: `COUNT(DISTINCT user_id)` where `status='active' AND expires_at > now()`, scoped by `game_id`.
- `stream_sessions` tracks broadcast metadata: `peak_viewers`, `current_viewers`, `started_at`, `ended_at`.
- Circuit breaker: client stops heartbeat interval after 3 consecutive failures, shows "Connection lost" banner.

## Admin Control Surface

- **Single location:** Gear-icon overlay dropdown on the Live page video wrapper.
- **Accessible to:** `super_admin` role only.
- **Controls:** Stream URL, broadcast title, live stats (status, viewers, PPV rev), Go Live / End Stream.
- **Auth:** Uses `getAuthToken()` for fresh JWT on every action.
- **Atomicity:** Config save and live toggle are separate API calls. If live toggle fails after config save, admin sees a specific error directing them to retry just the toggle.

## Performance Indexes

Hot-path indexes for 20K+ concurrent viewers:
- `stream_entitlements(user_id, game_id, status)` — every access check
- `stream_entitlements(expires_at) WHERE status='active'` — expiry queries
- `stream_access_sessions(user_id, expires_at)` — heartbeat checks
- `stream_access_sessions(game_id, status, expires_at)` — viewer counting
- `stream_reactions(game_id, created_at DESC)` — live event volume
- `stream_chat_messages(game_id, status, created_at DESC)` — chat room queries
