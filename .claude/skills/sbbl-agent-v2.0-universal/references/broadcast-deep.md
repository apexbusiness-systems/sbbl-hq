# SBBL HQ Broadcast Deep Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 -->

## Broadcast Architecture Overview

```
Admin → stream_admin_config (is_live, collection_id)
      → admin_sync_broadcast_to_sessions() [MANDATORY]
      → stream_sessions, stream_sources
      
Non-admin client → get_active_broadcast() RPC
                 → { stream_url, requires_payment, is_subscribed, ... }
                 
Viewer → PaywallGate (if requires_payment)
       → Onboarding (if not registered)
       → LiveStreamPlayer (if stream_url granted)
```

## `get_active_broadcast()` — Full Return Shape

```ts
{
  is_live:          boolean,   // broadcast is currently live
  stream_url:       string | null,  // null unless user may watch
  title:            string | null,
  active_game_id:   string | null,  // null for camera-only broadcast
  live_started_at:  string | null,
  requires_payment: boolean,  // registered user with no access → show paywall
  is_subscribed:    boolean,
  has_entitlement:  boolean,
  user_registered:  boolean,
}
```

## Access Decision Tree

```
get_active_broadcast() called
├── is_live = false → show "No Active Broadcast"
├── is_live = true, stream_url != null → PLAY
├── is_live = true, stream_url = null
│   ├── requires_payment = true → PaywallGate (PPV or subscription)
│   ├── user_registered = false → redirect to onboarding
│   └── (should not reach here — server grants url to all registered fans)
```

## Broadcast Route Table (FROZEN — no agent modifications)

| Method | Route | Handler | Auth |
|--------|-------|---------|------|
| GET | `/api/broadcast/access` | `handleBroadcastStreamAccess` | requireAuth |
| POST | `/api/broadcast/session` | `handleBroadcastSessionStart` | requireAuth |
| POST | `/api/broadcast/session/heartbeat` | `handleBroadcastHeartbeatRoute` | requireAuth |
| POST | `/api/broadcast/session/end` | `handleBroadcastSessionEndRoute` | requireAuth |

Canonical endpoint for `game.id === 'broadcast'`:
```ts
const endpoint = game.id === 'broadcast'
  ? '/api/broadcast/session'        // ✅ canonical
  : `/api/streams/${game.id}/session`;
// DO NOT use /api/streams/broadcast/* for this purpose
```

## PPV Flow

```
Player → /api/streams/:gameId/preview  → preview + price ($2.50 live / $1.50 replay)
       → /api/streams/:gameId/purchase → Stripe checkout session
       → Stripe webhook → stripe-webhook Edge Function → mark_order_paid()
       → create_stream_entitlement(..., status='active')  ← ALWAYS 'active'
       → /api/streams/:gameId/access → { hasAccess: true }
       → /api/streams/:gameId/session → session + signed playback token
```

## Replay System

- **Embargo:** 1–2 week post-game embargo before replay becomes available
- **Price:** $1.50/game (VITE_DEFAULT_PPV_PRICE env override for live)
- **Entitlement table:** `replay_entitlements`
- **Status check:** `GET /api/streams/:gameId/replay/status`

## Open Broadcast (Camera-Only) Access Logic

Broadcast = camera-only live event with no associated game row.
Access = registration only — `profiles.onboarding_completed_at IS NOT NULL`.

### Worker `handleStreamAccess` (M-01 fix):
```ts
if (gameId === 'broadcast') {
  const { data: cfg } = await admin.from('stream_admin_config').select('is_live').single();
  if (!cfg?.is_live) return { hasAccess: false };
  const { data: profile } = await admin.from('profiles')
    .select('onboarding_completed_at').eq('id', userId).single();
  return { hasAccess: profile?.onboarding_completed_at != null };
}
// For regular game streams: use can_user_view_stream(p_game_id, p_user_id)
```

### Worker `handlePlaybackSession`:
```ts
// ❌ BANNED — excludes regular registered fans
const hasAccess = hasPrivilegedRole;

// ✅ CORRECT
const { data: profile } = await admin.from('profiles')
  .select('onboarding_completed_at').eq('id', userId).single();
const isRegisteredFan = profile?.onboarding_completed_at != null;
const hasAccess = hasPrivilegedRole || isRegisteredFan;
```

## Fan Onboarding Flow (Broadcast Access Path)

```
Anon user → clicks Watch → PaywallGate
→ /onboarding?intent=fan&redirect=/live
→ (if unauth) → /auth?intent=fan&redirect=/live
→ Google OAuth → /login?intent=fan&redirect=/live (all params preserved)
→ Onboarding form (NO bio/avatar for fan)
→ complete_fan_onboarding(display_name, full_name, preferred_league)
→ onboarding_completed_at SET → access granted
```

**`?intent=fan` must survive all 4 round-trip points:**
1. `PaywallGate.onWatchClick` → embeds in URL
2. `Onboarding.tsx` Navigate → embeds in auth redirect URL
3. `Login.tsx` `useEffect` → reads `intentParam` and forwards
4. Google OAuth callback → `Login.tsx` `redirectTo` carries back

## `ppv_invites` — game_id TEXT Handling

`ppv_invites.game_id` is TEXT and may hold:
- A UUID string (game-bound invite)
- The literal string `'broadcast'` (open broadcast comp code)

Always use try/cast pattern in PL/pgSQL:
```sql
DECLARE v_game_uuid uuid; v_is_uuid boolean := false;
BEGIN
  v_game_uuid := v_invite.game_id::uuid; v_is_uuid := true;
EXCEPTION WHEN others THEN v_is_uuid := false;
END;
IF v_is_uuid THEN
  -- game-bound: create stream_entitlement row
ELSE
  -- open-broadcast: mark invite consumed, NO entitlement row
END IF;
```

## Stream Independence Contract — Full Rules

1. `stream_entitlements.game_id` is UUID (legacy column)
2. `ppv_invites.game_id` is TEXT (may be 'broadcast')
3. `stream_assignments.game_id` is UUID NULLABLE — streams are first-class
4. Never add NOT NULL to `game_id` on streams/stream_entitlements/stream_assignments
5. Always resolve stream URL via `stream_assignments → streams` join
6. Never read `games.stream_url` from worker or frontend paths

CI enforcement: `.github/workflows/stream-contract-gate.yml` (pglast AST parser)

## `can_user_view_stream` — Named Arguments ONLY

Multiple function overloads exist. Always use named args:
```sql
-- ✅ CORRECT
public.can_user_view_stream(p_game_id => v_game_id::text, p_user_id => v_user_id);

-- ❌ BANNED — silently binds to wrong overload
public.can_user_view_stream(v_user_id, v_game_id);
```

## Go Live Checklist (Admin)

```
1. Open broadcast control panel (super_admin only)
2. Set collection_id / stream source
3. Click "Go Live" → handleGoLive()
   a. Write stream_admin_config (is_live = true)
   b. Call admin_sync_broadcast_to_sessions() ← MANDATORY, non-fatal try/catch
   c. Confirm stream_sessions + stream_sources have rows
4. Verify get_active_broadcast() returns stream_url for a registered fan
5. Monitor: /api/public/streams/:gameId/reactions/aggregate, stream_access_sessions
```

## Known Tech Debt (S1 — LOW)

`useLiveAccess.ts` reads `stream_admin_config` directly at line 39 for `active_game_id`.
Per rule 6.1 this should come from `get_active_broadcast()`. The hook is admin-only
(guarded by `Live.tsx:1458`) so it's low risk. Tracked as contract violation S1.
