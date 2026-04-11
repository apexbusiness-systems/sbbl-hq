<!-- Version: v1.5.0 | Date: 2026-04-11 | Status: Current -->
# Stream Gating

**Version:** v1.5.0
**Previous:** v1.4.0 (2026-04-06)
**Last Updated:** 2026-04-11

## Changelog (v1.5.0)

- **Super-admin comp access codes:** Super-admins can now generate unlimited complimentary access codes
  per game. Codes are stored in `ppv_invites` with `is_comp = TRUE`. A partial unique index
  (`WHERE is_comp = FALSE`) preserves the one-invite-per-generator-per-game constraint for standard
  invites while leaving comp codes unbounded.
- **Viewer redeem widget (`AccessCodeRedeem`):** All viewers are presented with a code-redemption UI
  on `/live`. Entering a valid comp code grants stream access identical to a standard PPV invite.
- **Facebook embed navigation lockdown:** A transparent `pointer-events: all` overlay is rendered over
  the ReactPlayer frame for all non-super-admin viewers when the stream source is a Facebook URL
  (`facebook.com` or `fb.watch`). This prevents embedded FB UI elements (feed scrolling, video
  suggestions, social controls) from being interacted with. Super-admins retain full interactivity.
- **Super-admin account bootstrap (migration):** `sbblhqapp@gmail.com` is granted `super_admin` status
  via an `admin_email_grants` migration — no credentials are hardcoded in application code.
- **`handleInviteRedeem` server-side game derivation:** The Worker now derives `game_id` from the
  invite record rather than requiring the client to supply it. Eliminates a class of cross-game
  redemption attacks.

---

## PPV Entitlement Flow (v1.5.0)

1. **Purchase:** User clicks Buy → `POST /api/streams/:gameId/purchase` → Stripe Checkout session.
2. **Webhook:** Stripe fires `checkout.session.completed` → Worker verifies HMAC-SHA256 → calls
   `create_stream_entitlement` RPC → **6-hour** access window.
3. **Auto fan-profile:** Webhook auto-creates minimal fan profile if none exists (`onboarding_completed_at`
   set) so the buyer bypasses the onboarding gate on sign-in.
4. **Access check:** `can_user_view_stream(game_id, user_id)` RPC checks `stream_entitlements` and
   `ppv_invites`.
5. **Session creation:** `POST /api/streams/:gameId/session` creates `stream_access_sessions` row.
   - `expires_at = NOW() + 70s` (heartbeat window)
   - `max_expires_at = NOW() + 6h` (hard ceiling)
   - Any existing `status='active'` session for the same user + game is set to `status='displaced'`.
6. **Heartbeat:** Client sends `POST .../heartbeat` every 25s. Batch-flushed every 30s. Clamped at
   `max_expires_at`. After 3 consecutive failures → circuit breaker → "Connection lost".
7. **6hr cap client-side:** A `setTimeout` fires at `maxExpiresAt` on the client and halts playback
   with: *"Your 6-hour viewing session has ended. Purchase a new pass to continue."*
8. **Teardown:** `POST .../session/end` on component unmount.

## Comp Code Flow (v1.5.0)

1. **Generate:** Super-admin opens the Admin Stream Overlay → Comp Code tab → enters optional note and
   selects expiry → clicks Generate → `POST /ops/streams/comp-code` (super_admin only).
2. **Worker:** Inserts a `ppv_invites` row with `is_comp = TRUE`, `note`, and `expires_at`. No
   uniqueness constraint is applied across multiple comp codes for the same game.
3. **Share:** The generated UUID code is displayed in a copy-to-clipboard card. Super-admin shares
   it with the intended viewer via any channel.
4. **Redeem:** Viewer navigates to `/live` → sees the `AccessCodeRedeem` widget → enters code →
   `POST /ops/streams/invite/redeem` → Worker validates TTL, marks `status = 'used'`, returns
   `game_id` → client triggers access flow.
5. **Access check:** `can_user_view_stream` includes `ppv_invites` with `is_comp = TRUE` in its scan.
6. **Session creation:** Identical to standard PPV invite flow.

## Player Membership Flow (v1.5.0)

- **Price:** $7.00 CAD/month (recurring Stripe subscription)
- **Access:** Free livestream access on one device at a time
- **Session cap:** Same 6-hour hard ceiling per session start
- **Cancellation:** `customer.subscription.deleted` webhook removes `player` role and clears
  `subscription_ends_at`

## Invite-Based Access

- `ppv_invites` table: `id` (UUID) serves as the invite code.
- **Standard invites:** One invite per generator per game — enforced by partial unique index
  `UNIQUE(generated_by, game_id) WHERE is_comp = FALSE`.
- **Comp codes (`is_comp = TRUE`):** Unlimited per super-admin per game. Partial index does not apply.
- IP-locked on redemption. Single-use. TTL configurable (default 24h).
- Eligible generators for standard invites: `hasPremiumPlayerAccess || isPaidFan || isSuperAdmin`
- Comp code generation: `isSuperAdmin` only.

## Facebook Embed Security

| Viewer Role | Overlay | Interaction |
|-------------|---------|-------------|
| super_admin | None | Full FB embed interactivity |
| All others | Transparent `pointer-events: all` | Blocked — no feed, no navigation |

Detection: `/facebook\.com|fb\.watch/i.test(playbackUrl)` in `LiveStreamPlayer.tsx`.

## Session Status Lifecycle

```
active → displaced  (new session created for same user+game on another device)
active → ended      (session/end called, or 6-hour cap reached in batch flush)
active → active     (heartbeat extends expires_at, clamped at max_expires_at)
```

## CSP Directives (stream-relevant)

```
frame-src:  https://www.facebook.com https://web.facebook.com https://www.youtube.com
            https://player.vimeo.com https://challenges.cloudflare.com https://js.stripe.com
media-src:  'self' blob: https://video.xx.fbcdn.net https://*.fbcdn.net
```

## Database Schema (ppv_invites — v1.5.0 additions)

| Column       | Type        | Notes                                                         |
|--------------|-------------|---------------------------------------------------------------|
| id           | uuid PK     | Serves as the invite / comp code                              |
| game_id      | uuid        | FK → games                                                    |
| generated_by | uuid        | FK → auth.users                                               |
| status       | text        | pending / used / expired                                      |
| expires_at   | timestamptz | TTL; 24h default                                              |
| **is_comp**  | boolean     | **TRUE = comp code (unlimited); FALSE = standard (constrained)** |
| **note**     | text        | **Optional memo from super-admin at generation time**         |
| created_at   | timestamptz |                                                               |

## Database Schema (stream_access_sessions)

| Column          | Type        | Notes                                           |
|-----------------|-------------|------------------------------------------------|
| id              | uuid PK     |                                                 |
| user_id         | uuid        | FK → auth.users                                |
| game_id         | uuid        | FK → games                                     |
| idempotency_key | text        | UNIQUE(user_id, game_id, idempotency_key)       |
| status          | text        | active / ended / displaced                      |
| expires_at      | timestamptz | Heartbeat rolling window                        |
| max_expires_at  | timestamptz | Hard 6hr ceiling — never extended               |
| last_seen_at    | timestamptz | Last heartbeat timestamp                        |
| created_at      | timestamptz |                                                 |
| updated_at      | timestamptz |                                                 |

## Worker Routes (v1.5.0 additions)

| Method | Path                      | Auth       | Handler                       |
|--------|---------------------------|------------|-------------------------------|
| POST   | `/ops/streams/comp-code`  | super_admin | `handleSuperAdminCompCode`   |
| GET    | `/ops/streams/comp-code`  | super_admin | `handleSuperAdminCompCodeList` |
| POST   | `/ops/streams/invite/redeem` | authenticated | `handleInviteRedeem` (game_id server-derived) |
