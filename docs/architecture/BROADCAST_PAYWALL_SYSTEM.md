# Broadcast & Paywall System — v1.1.0

**Status:** Production · Stable
**Previous version:** v1.0.0 (2026-05-04)
**Version:** v1.1.0 (2026-05-06)
**Owners:** Streaming team
**Last reviewed:** 2026-05-06

**Changelog (v1.0.0 → v1.1.0):**
- Added §10 — Broadcast Stream Independence (HARD FREEZE). The open-broadcast
  path (`/api/broadcast/*`) is now fully decoupled from games, PPV, and
  entitlements. `handlePlaybackSession` rejects the `'broadcast'` alias and
  `null` gameId — those requests must use `/api/broadcast/*`.
- Updated §4 Worker API surface to document the canonical `/api/broadcast/*`
  route family.
- Updated §7 Migrations to include `20260506*` stream-independence commits.
- Updated §9 gotchas — removed stale `broadcast → null` normalization note.
- Added E2E acceptance test reference (`src/test/broadcast-access-e2e.test.ts`).

This document is the canonical reference for the SBBL HQ broadcast pipeline,
paywall, PPV code redemption, and fan onboarding system. **Read it before
editing any of the surfaces listed in §6–7 of `CLAUDE.md`.**

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN SIDE                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ AdminStreamOverlay  (Live.tsx, super_admin only)                │ │
│  │   ├─ stream URL input                                           │ │
│  │   ├─ Go Live button                                             │ │
│  │   └─ Comp code generator (POST /ops/streams/comp-code)          │ │
│  └─────────────┬───────────────────────────────────────────────────┘ │
│                │ handleGoLive()                                      │
│                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 1. goLive() / updateStreamConfig() / setStreamLive()            │ │
│  │    → writes stream_admin_config (collection_id, is_live)        │ │
│  │ 2. admin_sync_broadcast_to_sessions()                           │ │
│  │    → writes stream_sessions (game_id, status='live')            │ │
│  │    → writes stream_sources (game_id, source_url)                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                ║
                                ║  Database (Supabase)
                                ║
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT SIDE                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ get_active_broadcast() RPC  ◄── single oracle for non-admin     │ │
│  │   • Reads stream_admin_config + profiles + entitlements         │ │
│  │   • Calls is_premium_subscriber() + can_user_view_stream()      │ │
│  │   • Returns stream_url ONLY when user may watch                 │ │
│  └─────────────┬───────────────────────────────────────────────────┘ │
│                │                                                     │
│      ┌─────────┴───────────┬──────────────────┐                      │
│      ▼                     ▼                  ▼                      │
│   stream_url=null     stream_url=null     stream_url=URL             │
│   user=null           requires_payment    has_entitlement            │
│      │                     │              OR is_subscribed           │
│      ▼                     ▼                  ▼                      │
│   PaywallGate          PaywallGate         LiveStreamPlayer          │
│   (anon mode)          (Panel A: code      (or fallbackBroadcastGame │
│   "Register"           Panel B: purchase)   for camera-only)         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database surface

### 2.1 Tables (do not modify schema without an architecture review)

| Table | Purpose | Key invariants |
|---|---|---|
| `stream_admin_config` | Singleton (`id=true`) holding live state, URL, title, `active_game_id` | `collection_id` stores the actual stream URL despite the misleading column name |
| `stream_sessions` | One row per active broadcast game | `status='live'` while broadcasting; written by `admin_sync_broadcast_to_sessions` |
| `stream_sources` | Stream URL per game for viewer queries | `is_public_source=true` for RLS to release the row |
| `stream_entitlements` | Per-user PPV / code-redemption grants | `status='active'` (NEVER `'purchased'`), `game_id` is `uuid` |
| `ppv_invites` | Comp codes + regular invites | `code` is `SBBL-XXXX-XXXX`; `game_id` is **TEXT** (may hold `'broadcast'` sentinel) |
| `profiles` | User profile + subscription state | `subscription_ends_at > now()` = premium subscriber; `onboarding_completed_at IS NOT NULL` = registered |

### 2.2 Functions (canonical list)

| Function | Signature | Notes |
|---|---|---|
| `get_active_broadcast()` | `() → jsonb` | **Single source of truth for client access.** Server-side stream_url gating. |
| `can_user_view_stream(p_game_id text, p_user_id uuid)` | `→ boolean` | **Multiple overloads exist** — always use named arguments. |
| `create_stream_entitlement(p_game_id uuid, ...)` | `→ jsonb` | Inserts `status='active'`. |
| `redeem_ppv_invite(p_code text)` | `→ jsonb` | Handles `'broadcast'` sentinel game_id without crashing. |
| `complete_fan_onboarding(p_display_name, p_full_name, p_preferred_league)` | `→ jsonb` | **NEVER sets bio or avatar_url.** |
| `is_premium_subscriber(p_user_id uuid)` | `→ boolean` | Wraps `subscription_ends_at > now()`. |
| `admin_sync_broadcast_to_sessions(p_game_id, p_stream_url, p_is_going_live)` | `→ void` | Called by admin Go Live AFTER the primary write. |

### 2.3 RLS posture

- `stream_sessions` SELECT: `status='live'` for both `authenticated` and `anon`
- `stream_sources` SELECT: `is_public_source=true` for both `authenticated` and `anon`
- `stream_entitlements`: existing `service_role_only_baseline` (read via SECURITY DEFINER functions only)
- `ppv_invites`: existing owner/redeemer policies; `redeem_ppv_invite` is SECURITY DEFINER for the lookup

---

## 3. Access decision matrix

This is the complete truth table that `get_active_broadcast()` implements.
Any change to the function MUST keep this matrix intact.

| Broadcast | User | Onboarding | Subscription | Entitlement | `stream_url` | `requires_payment` | UI |
|---|---|---|---|---|---|---|---|
| Offline | any | any | any | any | `null` | `false` | "No Active Broadcast" |
| Live | anon | n/a | n/a | n/a | `null` | `false` | PaywallGate (Mode A — Register) |
| Live | auth | incomplete | n/a | n/a | `null` | `false` | Redirect to `/onboarding?intent=fan&redirect=/live` |
| Live + game_id | auth | done | yes | n/a | URL | `false` | Player |
| Live + game_id | auth | done | no | yes | URL | `false` | Player |
| Live + game_id | auth | done | no | no | `null` | `true` | PaywallGate (Mode B — Code + Purchase) |
| Live + open broadcast (no game_id) | auth | done | any | n/a | URL | `false` | Player (server grants free access) |
| Live + open broadcast | auth | done | no | n/a | URL | `false` | Player + `fallbackBroadcastGame` mounts |
| Any | super_admin | any | any | any | (admin path) | n/a | AdminStreamOverlay + Player |

---

## 4. Code redemption flow

```
User enters SBBL-XXXX-XXXX
         │
         ▼
PaywallGate.handleRedeemCode()
         │
         ▼
supabase.rpc('redeem_ppv_invite', { p_code })
         │
         ├─ not_authenticated   → "Sign in to redeem"
         ├─ invalid_code        → "Code doesn't exist"
         ├─ code_expired        → "This code has expired"
         ├─ code_already_used   → "Already used"
         ├─ already_redeemed    → idempotent OK
         │                        (re-redemption by same user)
         │
         ▼
Mark invite consumed (used_by, used_at, ip_address)
         │
         ├─ game_id is UUID    → create_stream_entitlement()
         │                        → status='redeemed'
         │
         └─ game_id is non-UUID → return status='open_broadcast'
            ('broadcast', etc.)   (no entitlement row needed; access
                                    granted via registration)
         │
         ▼
PaywallGate.onSuccess() → handleBroadcastRefetch()
         │
         ▼
broadcastQuery refetches → stream_url populated → Player renders
```

---

## 5. Admin Go Live flow

```
Admin clicks "Go Live"
         │
         ▼
handleGoLive() in AdminStreamOverlay
         │
         ▼
1. Try POST /api/ops/stream/golive (atomic)
   OR fall back to:
   1a. POST /api/ops/stream/config  (collection_id + title)
   1b. POST /api/ops/stream/live    (is_live toggle)
         │
         ▼
2. supabase.rpc('admin_sync_broadcast_to_sessions', {
     p_game_id, p_stream_url, p_is_going_live: true
   })
         │
         ├─ Success: stream_sessions + stream_sources upserted
         └─ Failure: NON-FATAL — primary state already saved.
                     Admin sees Go Live succeed; viewer sync may
                     lag by one cycle (15s polling catches up).
         │
         ▼
3. setStreamNonce(n+1) → forces broadcastQuery refetch on viewers
                          via React Query key invalidation
```

**Why the second sync call must stay non-fatal:** Bug A4/A5 demonstrated
that without writing to `stream_sessions` + `stream_sources`, RLS-gated
viewer queries return empty. But if we made the sync transactional with
the primary go-live, a transient sync failure would prevent admins from
broadcasting at all. The current design fails open for the admin and
self-heals on the next sync cycle.

---

## 6. Frontend integration points

### 6.1 `Live.tsx`

| Concern | Hook / state | Guard |
|---|---|---|
| Admin URL/status | `fetchAdminStreamConfig()` | `if (isSuperAdmin)` |
| Non-admin broadcast oracle | `useQuery('get-active-broadcast', streamNonce)` | `enabled: !isSuperAdmin` |
| Force refetch after grant | `setStreamNonce(n => n + 1)` | called by `onSuccess` of PaywallGate |
| Onboarding gate | `if (needsOnboarding)` | redirects to `/onboarding?intent=fan&redirect=/live` |
| PaywallGate render | `!isSuperAdmin && broadcast?.is_live && !broadcast?.stream_url` | branches anon vs registered |
| `fallbackBroadcastGame` | `hasBroadcastFallbackAccess \|\| broadcast?.stream_url != null` | server-granted access included |

### 6.2 `PaywallGate.tsx`

| Mode | Trigger | UI |
|---|---|---|
| Mode A (anon) | `isAnon=true` (no user) | Single "Register to Watch" CTA |
| Mode B (registered) | `isAnon=false`, `requires_payment=true` | Panel A (code) + Panel B (purchase) |

The component is the ONLY surface that calls `redeem_ppv_invite()`. The
purchase flow re-uses the existing `/api/streams/:gameId/purchase` Stripe
endpoint — DO NOT duplicate or modify the payment path.

### 6.3 `LiveStreamPlayer.tsx` — broadcast routing

When `game.id === 'broadcast'`, the player calls the `/api/broadcast/*`
canonical endpoints. **Never** route through `/api/streams/broadcast/*`
(legacy aliases remain for backward compatibility only):

| Action | Endpoint |
|---|---|
| Access check | `GET /api/broadcast/access` |
| Session start | `POST /api/broadcast/session` |
| Heartbeat | `POST /api/broadcast/session/heartbeat` |
| Session end | `POST /api/broadcast/session/end` |

For a real game UUID, the player uses `/api/streams/:gameId/*` (PPV path).
The two paths are mutually exclusive and must never be merged.

### 6.4 `Onboarding.tsx`

| Branch | Triggered when | RPC called |
|---|---|---|
| Fan | `form.primaryRoleIntent === 'fan'` (default for `?intent=fan`) | `complete_fan_onboarding()` |
| Player | `form.primaryRoleIntent === 'player'` | `saveOnboarding()` (existing) |
| Coach | `form.primaryRoleIntent === 'coach'` | `saveOnboarding()` + coach-pending UI |

Bio + avatar fields are gated by `{!isFan && ...}`. The fan branch never
collects them and `complete_fan_onboarding()` will reject any attempt to
write them at the SQL layer.

### 6.5 `Login.tsx`

Preserves `?intent=` and `?redirect=` through:

- Email/password sign-in: `useEffect` reads `intentParam` + `redirectTo`,
  forwards to `/onboarding?...` with both
- Google OAuth: `signInWithOAuth({ redirectTo })` carries both params
  back to `/login` after the OAuth round-trip; the same `useEffect`
  then forwards to onboarding

---

## 7. Migrations (chronological)

| Migration | Purpose |
|---|---|
| `20260504000100_fix_stream_rls_and_read_policies.sql` | RLS SELECT policies for `stream_sessions` + `stream_sources` |
| `20260504000200_fix_entitlement_status_mismatch.sql` | `'active'` enum value + `create_stream_entitlement` insert fix |
| `20260504000300_add_ppv_invite_code_column_and_generator.sql` | `code` column + `SBBL-XXXX-XXXX` generator + trigger |
| `20260504000400_add_redeem_ppv_invite_function.sql` | `redeem_ppv_invite()` SECURITY DEFINER (initial) |
| `20260504000500_add_fan_onboarding_and_subscription_helpers.sql` | `complete_fan_onboarding()` + `is_premium_subscriber()` |
| `20260504000600_add_get_active_broadcast_function.sql` | `get_active_broadcast()` oracle (initial) |
| `20260504000700_add_admin_broadcast_sync_function.sql` | `admin_sync_broadcast_to_sessions()` |
| `20260504100000_hotfix_broadcast_paywall_audit.sql` | **Audit hotfix:** rebuilds `get_active_broadcast` (named args) and `redeem_ppv_invite` (UUID-cast guard) |

**No new migrations were added in v1.1.0.** All changes are in the worker and
frontend layers only. The DB schema is unchanged.

---

## 8. Acceptance test matrix

The following scenarios MUST pass before any change to this system ships.
**Run `npm test` — all 100 test files (1090+ assertions) must be green.**
The broadcast-specific suite is `src/test/broadcast-access-e2e.test.ts`
(15 assertions, all user classes A–E).

```
S1.  Admin presses Go Live → stream_admin_config.is_live=true
                            → stream_sessions row created (status='live')
                            → stream_sources row created (is_public_source=true)
S2.  Admin presses End Stream → stream_admin_config.is_live=false
                              → stream_sessions row updated (status='ended')
S3.  Anon visits /live with broadcast live
     → get_active_broadcast returns stream_url=null, requires_payment=false
     → PaywallGate Mode A renders ("Register to Watch")
S4.  Anon clicks Register → /onboarding?intent=fan&redirect=/live
S5.  Onboarding redirects unauthenticated user to /login?redirect=...
S6.  After signup + email confirm + sign-in:
     → Login redirects to /onboarding?intent=fan&redirect=/live
     → Fan form shows ONLY display_name, full_name, preferred_league
     → Bio, avatar, jersey, position, height, team are NOT in DOM
S7.  Fan submits → complete_fan_onboarding() RPC → /live
S8.  Registered fan, broadcast live, no entitlement, no subscription:
     → get_active_broadcast returns stream_url=null, requires_payment=true
     → PaywallGate Mode B renders (code panel + purchase panel)
S9.  Fan enters valid SBBL-XXXX-XXXX code:
     → redeem_ppv_invite returns ok=true
     → onSuccess → broadcastQuery refetches
     → stream_url now populated → player renders
S10. Fan enters expired code → "This code has expired"
S11. Fan enters used code → "This code has already been used"
S12. Fan enters invalid code → "That code doesn't exist"
S13. Premium subscriber visits /live:
     → is_subscribed=true → stream_url populated → player renders
S14. Open broadcast (no active_game_id) + registered fan:
     → has_entitlement=true (registered users get free access)
     → stream_url populated → fallbackBroadcastGame mounts → player renders
S15. Open broadcast + super_admin:
     → admin path unchanged → AdminStreamOverlay + player renders
S16. Code redemption for 'broadcast' (open-broadcast comp code):
     → redeem_ppv_invite handles non-UUID game_id → status='open_broadcast'
     → No exception thrown; invite marked consumed
S17. get_active_broadcast with active_game_id set:
     → can_user_view_stream called with named args (text, uuid order correct)
     → returns true for entitled users
S18. Google OAuth sign-in from /login?intent=fan&redirect=/live:
     → After OAuth round-trip lands on /login?intent=fan&redirect=/live
     → useEffect forwards to /onboarding?intent=fan&redirect=/live
```

---

## 9. Known constraints and gotchas

- **Polling vs. realtime:** Viewers wait up to 15s after admin Go Live
  before their broadcastQuery picks up the change. Acceptable for current
  scale; consider Supabase Realtime subscription for future refactor.
- **`streamNonce` shared between admin + viewer:** The admin's go-live
  callback and the viewer's PaywallGate.onSuccess both increment the same
  React state. Safe today (admin and viewer flows are mutually exclusive
  per page load via `enabled: !isSuperAdmin`) but worth refactoring if
  you add hybrid roles.
- **`'broadcast'` sentinel in `ppv_invites.game_id`:** The string
  `'broadcast'` stored in `ppv_invites.game_id` (TEXT column) signals an
  open-broadcast comp code with no game binding. `redeem_ppv_invite()`
  detects this with a UUID-cast guard and returns `status='open_broadcast'`
  without creating an entitlement row. Do NOT remove this guard.
- **`handlePlaybackSession` rejects `'broadcast'` and null gameId** (v1.1.0):
  Both `params.gameId === null` and `params.gameId === 'broadcast'` return
  `400 use_broadcast_endpoint`. All open-broadcast traffic must go through
  `/api/broadcast/*`. This replaced the old `broadcast → null` normalization
  hack.
- **`stream_admin_config.collection_id`:** Misleadingly named — actually
  stores the stream URL. Renaming requires coordinated migration +
  worker + frontend update; not worth it.

---

## 10. Broadcast Stream Independence — HARD FREEZE

> **Do not modify this section or its enforcement targets without explicit
> written approval from the repo owner (JR).**

The open broadcast route family is atomically independent of games, PPV,
and entitlements. It is the operator's exclusive media channel.

### 10.1 Route ownership

| Route | Handler | Owned since |
|---|---|---|
| `POST /api/broadcast/access` | `handleBroadcastStreamAccess` | v1.1.0 (2026-05-06) |
| `POST /api/broadcast/session` | `handleBroadcastSessionStart` | v1.1.0 (2026-05-06) |
| `POST /api/broadcast/session/heartbeat` | `handleBroadcastHeartbeatRoute` | v1.1.0 (2026-05-06) |
| `POST /api/broadcast/session/end` | `handleBroadcastSessionEndRoute` | v1.1.0 (2026-05-06) |

Legacy aliases at `/api/streams/broadcast/*` remain for backward
compatibility but delegate to the same handlers above.

### 10.2 Access model (unchangeable)

```
Requirement to watch an open broadcast:
  onboarding_completed_at IS NOT NULL   ← the ONLY check

No PPV. No game. No entitlement row. No can_user_view_stream call.
```

### 10.3 Enforcement

- **CLAUDE.md Rule 7:** Hard freeze documented in the agent guide.
- **Tests:** `src/test/broadcast-access-e2e.test.ts` — 15 assertions
  covering all 5 user classes (registered fan, player, super admin,
  unregistered, offline stream).
- **Guard in `handlePlaybackSession`:** Returns `400 use_broadcast_endpoint`
  for `gameId === null` or `gameId === 'broadcast'` — prevents accidental
  routing through the PPV path.

### 10.4 What agents must NOT do to these routes

- Add `game_id`, `gameId`, or any game parameter.
- Add PPV or entitlement logic.
- Add `can_user_view_stream` calls.
- Rename or move the routes.
- Add additional authentication beyond `requireAuth(req)`.
