# SBBL HQ Hard Rules Reference
<!-- Version: v2.0.0 | Source: CLAUDE.md | Date: 2026-05-20 -->

## Rule 1 — No Mock Data in Production

**Banned imports (ESLint `no-restricted-imports` + CI vitest guard):**
- `src/data/mock.ts`
- `src/data/schedules.ts`
- `src/data/teams.ts`

**Banned patterns:**
```ts
// ❌ BANNED — silently hides pipeline outages
const players = apiData && apiData.length > 0 ? apiData : mockPlayers;
const potg = apiPotg ?? playersOfTheGame;

// ✅ CORRECT — empty state is explicit
const players = Array.isArray(apiData) ? apiData : [];
```

**League identity metadata:** Use `LEAGUE_REGISTRY` from `src/lib/leagues.ts`.

**League slug→UUID resolution (worker):** `league_id` columns are uuid FKs.
Never pass a client-supplied league value into a `league_id` filter or write —
resolve it via `resolveLeagueId` / `resolveLeagueIdFilter` from
`src/worker/shared.ts` (CLAUDE.md rule 10, PR #571; CI-guarded by
`src/test/league-filter-guard.test.ts`).

---

## Rule 2 — Public Pages → Public Endpoints

Anonymous pages (Stats, Leaderboards, Scores, Schedules, Home, AppHome, Store, Teams)
**MUST** call `/api/public/*` or `/api/teams` / `/api/scores`.

Endpoints under `/api/stats`, `/api/leaderboards`, `/api/auth/*` require `requireAuth(req)`
and will **401 for anonymous users**.

Before wiring a page to an endpoint: `grep worker for requireAuth(req)` in the handler.

---

## Rule 3 — Stream Independence Contract (HARD CI GATE)

**NEVER** couple streams/stream_assignments/stream_entitlements to a NOT NULL `game_id`.

**Banned SQL:**
```sql
-- ❌ BANNED
ALTER TABLE streams ADD COLUMN game_id uuid NOT NULL;
ALTER TABLE stream_entitlements ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE stream_assignments ALTER COLUMN game_id SET NOT NULL;
```

**Banned TS:**
```ts
// ❌ BANNED
const url = game.stream_url;

// ✅ CORRECT
const { data } = await admin
  .from("stream_assignments")
  .select("streams(stream_url, source_platform)")
  .eq("game_id", gameId)
  .eq("is_active", true)
  .maybeSingle();
```

Enforced by: CI AST gate (pglast) + armageddon-stream-invariants.test.ts + stream-chaos-battery.test.ts

---

## Rule 4 — Media Publications — Pin Before Archive, Two-Phase Cleanup

- Pinned media CANNOT be archived (worker returns 409). Unpin first.
- Stale cleanup: preview → confirm (type ARCHIVE) → execute (re-validates server-side).
- Bulk archive: `bulk_archive_media_publications()` RPC — transactional atomicity.
- `updated_at` maintained by BEFORE UPDATE trigger on `media_publications`.
- Default ordering: `created_at DESC` (newest-first), NOT `sort_order ASC`.
- Bulk archive response `ids` = only IDs actually transitioned (silently skips already-archived).

---

## Rule 5 — Live Player Invariants (DO NOT REGRESS v1.4.0)

### 5.1 — Layout: never combine `absolute` with `relative` on player wrapper
```tsx
// ✅ CORRECT
<div className="absolute inset-0 flex flex-col z-0">

// ❌ BANNED — Tailwind emits position:relative last; wrapper collapses
<div className="absolute inset-0 flex flex-col relative z-0">
```

### 5.2 — Timers: every setTimeout/setInterval MUST be cleared on unmount
Pattern: `hardCapTimerId` and `autoRetryTimerRef` in `LiveStreamPlayer.tsx`.
1. Capture handle in ref or local var
2. Clear in effect cleanup
3. Clear before scheduling replacement

### 5.3 — Unembeddable URLs bail BEFORE ReactPlayer mounts
| Type | Handling |
|------|----------|
| `rtmp` | Advisory panel |
| `facebook` | `plugins/video.php` iframe (no FB SDK; `frame-src` allows `facebook.com`) |
| `kick`, `instagram`, `x-spaces` | Advisory panel |

```ts
// ❌ BANNED
<ReactPlayer url={facebookUrl} />

// ✅ CORRECT
if (isFacebook) return <FacebookIframeEmbed url={url} />;
```

### 5.4 — react-player must be lazy-loaded
```ts
// ✅ CORRECT
import ReactPlayer from 'react-player/lazy';
// ❌ BANNED (lint-blocked)
import ReactPlayer from 'react-player';
```

Regression tests: `src/test/live-stream-player-regressions.test.ts` (11 assertions, mutation-tested)

---

## Rule 6 — Broadcast & Paywall System

### 6.1 — `get_active_broadcast()` is the SINGLE access oracle

Returns:
```ts
{
  is_live: boolean, stream_url: string | null, title: string | null,
  active_game_id: string | null, live_started_at: string | null,
  requires_payment: boolean, is_subscribed: boolean,
  has_entitlement: boolean, user_registered: boolean,
}
```

```ts
// ❌ BANNED — bypasses server-side gating
const { data } = await supabase.from('stream_admin_config').select('collection_id').single();

// ✅ CORRECT
const { data: broadcast } = await supabase.rpc('get_active_broadcast');
if (broadcast.stream_url) play(broadcast.stream_url);
else if (broadcast.requires_payment) showPaywallGate();
```

### 6.2 — `can_user_view_stream` signature: `(p_game_id text, p_user_id uuid)` — named args ONLY

### 6.3 — `ppv_invites.game_id` is TEXT — may hold literal `'broadcast'`
```sql
-- ❌ BANNED
SELECT public.create_stream_entitlement(v_invite.game_id::uuid, ...);

-- ✅ CORRECT — try cast, handle exception
DECLARE v_game_uuid uuid; v_is_uuid boolean := false;
BEGIN v_game_uuid := v_invite.game_id::uuid; v_is_uuid := true;
EXCEPTION WHEN others THEN v_is_uuid := false; END;
```

### 6.4 — `entitlement_status = 'active'` ALWAYS (never `'purchased'`)

### 6.5 — Fan onboarding NEVER sets `bio` or `avatar_url`
Use `complete_fan_onboarding(p_display_name, p_full_name, p_preferred_league)` RPC.
Fan paths NEVER call `saveOnboarding()`.

### 6.6 — Admin `Go Live` MUST sync `stream_sessions + stream_sources` via `admin_sync_broadcast_to_sessions()`

### 6.7 — `fallbackBroadcastGame` must honor BOTH `hasBroadcastFallbackAccess` AND `broadcast?.stream_url != null`

### 6.8 — `?intent=fan` must survive sign-in round-trips (4 surfaces: PaywallGate, Onboarding, Login, Google OAuth callback)

### 6.9 — Worker endpoints MUST mirror DB oracle for open broadcasts (M-01 fix)
```ts
// For gameId === 'broadcast' in handleStreamAccess
// ❌ BANNED — no entitlement rows exist for open broadcasts
const result = await can_user_view_stream('broadcast', userId);

// ✅ CORRECT
if (gameId === 'broadcast') {
  const { data: cfg } = await admin.from('stream_admin_config').select('is_live').single();
  if (!cfg?.is_live) return { hasAccess: false };
  const { data: profile } = await admin.from('profiles')
    .select('onboarding_completed_at').eq('id', userId).single();
  return { hasAccess: profile?.onboarding_completed_at != null };
}
```

Regression tests: `src/test/worker-stream-hardening.test.ts` (5 assertions)

---

## Rule 7 — Broadcast Stream Independence (HARD FREEZE — DO NOT TOUCH)

`/api/broadcast/*` routes are **off-limits for agent modification** without explicit owner direction.

Frozen routes:
- `POST /api/broadcast/access`
- `POST /api/broadcast/session`
- `POST /api/broadcast/session/heartbeat`
- `POST /api/broadcast/session/end`

**Broadcast access = registration ONLY** (`onboarding_completed_at IS NOT NULL`).
No PPV, no game entitlement, no `can_user_view_stream`.

When `game.id === 'broadcast'`:
```ts
// ✅ CORRECT — canonical broadcast endpoint
const endpoint = game.id === 'broadcast'
  ? '/api/broadcast/session'
  : `/api/streams/${game.id}/session`;
```

---

## Rule 8 — OmniBridge (DO NOT DRIFT)

See `references/omnibridge-deep.md` for full spec.
Before touching `handleOmnihubWebhook`, `handleOmniportCommand`, `deliverSyncEnvelope`, or `handleSyncDrain`:
- Verify HMAC, idempotency check, allowlist check, BLOCKED-lane check are all intact.
- All 14 integration tests (`src/worker/tests/omnihub-bridge.integration.test.ts`) must pass.

---

## Incident Log (Relevant to Rules)

| Date | Incident | Root Cause | Fixed In |
|------|----------|------------|----------|
| 2026-05-06 | M-01: Open broadcast fan-view gap | Worker independently denied registered fans | Rule 6.9 + worker-stream-hardening.test.ts |
| 2026-04-16 | Live data regression | Mock fallbacks silently serving fake data | Rule 1 + ESLint guards |
| 2026-04-04 | PPV purchase silently rejected | entitlement_status='purchased' instead of 'active' | Rule 6.4 + migration 20260504000200 |
