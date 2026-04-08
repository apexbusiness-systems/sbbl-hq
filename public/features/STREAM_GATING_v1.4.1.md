<!-- Version: v1.4.1 | Date: 2026-04-07 | Status: Current -->
# Stream Gating

**Version:** v1.4.1
**Previous:** v1.4.0 (2026-04-06)
**Last Updated:** 2026-04-07

## Changelog (v1.4.1)

- Added ingress/render endpoint QA matrix reference and evidence artifacts for stream route validation (status/purchase/session/heartbeat/comments/reactions).
- **6-hour session hard cap:** Each playback session now has a `max_expires_at` field set at creation
  (`NOW() + 6h`). Heartbeats are clamped by `batch_heartbeat_upsert()` so a session can never be
  extended past this ceiling. The client auto-stops at `maxExpiresAt` with a toast notification.
- **One-device enforcement:** `createOrRefreshPlaybackSession()` displaces any existing `status='active'`
  session for the same user + game before creating the new one. The displaced device's next heartbeat
  returns `session_not_found` â†’ circuit breaker â†’ "Connection lost" banner.
- **Heartbeat batch-write (20K perf):** Heartbeats are queued in-memory and flushed every 30s via a
  single `batch_heartbeat_upsert(jsonb)` RPC call. At 20K viewers / 25s interval this cuts ~800
  individual DB writes/s to ~1 bulk call every 30s.
- **PPV auto fan-profile:** When a fan purchases PPV without completing onboarding, the Stripe webhook
  handler auto-creates a minimal profile with `onboarding_completed_at = NOW()`. This bypasses the
  onboarding gate so the buyer lands directly on `/live`.
- **Admin client cached per-isolate:** `getAdminClient()` caches the Supabase service-role client at
  module level, eliminating a new `createClient()` call on every request.
- **Auth boot latency:** `AuthContext.load()` reads from localStorage first and only calls `getUser()`
  (network round-trip) when the token is expired or expiring within 60 seconds. Eliminates 150-300ms
  cold-mount latency for fresh sessions.
- **Facebook Live support:** ReactPlayer receives a `facebook` config block. `fbclid` tracking
  parameters are stripped before playback begins. CSP adds `media-src https://*.fbcdn.net`.

---

## PPV Entitlement Flow (v1.4.0)

1. **Purchase:** User clicks Buy â†’ `POST /api/streams/:gameId/purchase` â†’ Stripe Checkout session.
2. **Webhook:** Stripe fires `checkout.session.completed` â†’ Worker verifies HMAC-SHA256 â†’ calls
   `create_stream_entitlement` RPC â†’ **6-hour** access window.
3. **Auto fan-profile:** Webhook auto-creates minimal fan profile if none exists (`onboarding_completed_at`
   set) so the buyer can bypass the onboarding gate on sign-in.
4. **Access check:** `can_user_view_stream(game_id, user_id)` RPC checks `stream_entitlements` and
   `ppv_invites`.
5. **Session creation:** `POST /api/streams/:gameId/session` creates `stream_access_sessions` row.
   - `expires_at = NOW() + 70s` (heartbeat window)
   - `max_expires_at = NOW() + 6h` (hard ceiling)
   - Any existing `status='active'` session for the same user + game is set to `status='displaced'`.
6. **Heartbeat:** Client sends `POST .../heartbeat` every 25s. Batch-flushed every 30s. Clamped at
   `max_expires_at`. After 3 consecutive failures â†’ circuit breaker â†’ "Connection lost".
7. **6hr cap client-side:** A `setTimeout` fires at `maxExpiresAt` on the client and halts playback
   with: *"Your 6-hour viewing session has ended. Purchase a new pass to continue."*
8. **Teardown:** `POST .../session/end` on component unmount.

## Player Membership Flow (v1.4.0)

- **Price:** $7.00 CAD/month (recurring Stripe subscription)
- **Access:** Free livestream access on one device at a time (one-device enforcement identical to PPV)
- **Session cap:** Same 6-hour hard ceiling per session start
- **Cancellation:** `customer.subscription.deleted` webhook removes `player` role and clears
  `subscription_ends_at`

## Invite-Based Access

- `ppv_invites` table: `id` (UUID) serves as the invite code. One invite per generator per game
  (`UNIQUE(generated_by, game_id)`).
- IP-locked on redemption. Single-use. 24-hour TTL.
- Eligible generators: `hasPremiumPlayerAccess || isPaidFan || isSuperAdmin`

## Session Status Lifecycle

```
active â†’ displaced  (new session created for same user+game on another device)
active â†’ ended      (session/end called, or 6-hour cap reached in batch flush)
active â†’ active     (heartbeat extends expires_at, clamped at max_expires_at)
```

## CSP Directives (stream-relevant)

```
frame-src: https://www.facebook.com https://web.facebook.com https://www.youtube.com
           https://player.vimeo.com https://challenges.cloudflare.com https://js.stripe.com
media-src:  'self' blob: https://video.xx.fbcdn.net https://*.fbcdn.net
```

## Database Schema (stream_access_sessions)

| Column          | Type        | Notes                                           |
|-----------------|-------------|------------------------------------------------|
| id              | uuid PK     |                                                 |
| user_id         | uuid        | FK â†’ auth.users                                |
| game_id         | uuid        | FK â†’ games                                     |
| idempotency_key | text        | UNIQUE(user_id, game_id, idempotency_key)       |
| status          | text        | active / ended / displaced                      |
| expires_at      | timestamptz | Heartbeat rolling window                        |
| **max_expires_at** | timestamptz | **Hard 6hr ceiling â€” never extended**         |
| last_seen_at    | timestamptz | Last heartbeat timestamp                        |
| created_at      | timestamptz |                                                 |
| updated_at      | timestamptz |                                                 |


## Validation Reference (2026-04-07)

- Stream route runtime-smoke evidence: `docs/quality/evidence/ingress_render_worker_2026-04-07.log`
- Full route runtime-smoke evidence (90 routes): `docs/quality/evidence/all_worker_routes_2026-04-07.log`
- Route inventory + coverage map: `docs/quality/evidence/route_inventory_2026-04-07.json`, `docs/quality/evidence/worker_route_coverage_2026-04-07.json`
- QA Matrix (signed): `docs/quality/INGRESS_RENDER_QA_MATRIX_2026-04-07_v1.1.0.md`
