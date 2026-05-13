# Claude / Agent Operating Guide â SBBL-HQ

Welcome. This document is the **single source of truth** for agents
working in this repo. Read it in full before your first edit.

## ð¨ HARD RULES â Do not break these

### 1. No mock data in production pages

**NEVER** import from `src/data/mock.ts`, `src/data/schedules.ts`, or
`src/data/teams.ts` anywhere under `src/pages/**`, `src/components/**`,
`src/hooks/**`, `src/contexts/**`, `src/worker/**`, or `src/lib/**`.

Those files are test fixtures. Importing them from production code has
repeatedly caused live-data outages to be invisible to users (the UI
silently renders fake players, scores, and products instead of failing).

**Use instead:** the `/api/public/*` worker endpoints. See
[`docs/protocols/no-mock-in-production.md`](docs/protocols/no-mock-in-production.md)
for the canonical endpoint table.

This rule is enforced by:

- **ESLint** `no-restricted-imports` (see `eslint.config.js`) â lint runs
  with `--max-warnings 0` in CI.
- **vitest** guard test (`src/test/no-mock-in-production.test.ts`).
- **CI** (`.github/workflows/ci.yml`) â both gates block merge.

If you see a test failure pointing at those files, **do not disable the
test**. Fix the import.

If you need league identity metadata (codes, names, colors, logos), use
`LEAGUE_REGISTRY` from `src/lib/leagues.ts`. It is the canonical source.

### 2. No `|| mockX` / `?? mockX` fallbacks

Do not write:

```ts
// â BANNED â silently hides pipeline outages.
const players = apiData && apiData.length > 0 ? apiData : mockPlayers;
const potg = apiPotg ?? playersOfTheGame;
```

Do write:

```ts
// â CORRECT â empty state is visible.
const players = Array.isArray(apiData) ? apiData : [];
```

Render an explicit empty-state UI when the array is empty. Never
substitute fixtures.

### 3. Public pages â public endpoints

If a page is anonymous-accessible (Stats, Leaderboards, Scores,
Schedules, Home, AppHome, Store, Teams), it must call a public worker
endpoint (`/api/public/*` or `/api/teams` / `/api/scores`). Endpoints
under `/api/stats`, `/api/leaderboards`, `/api/auth/*` etc. require auth
(`requireAuth(req)` in the worker) and **will 401 for anonymous users**,
silently killing the data flow.

Before wiring a page to a new endpoint, grep the worker for
`requireAuth(req)` in the handler. If present and the page is public,
use or add a `/api/public/*` variant instead.

### 4. Stream Independence Contract â streams are not games

**NEVER** couple `streams`, `stream_assignments`, or
`stream_entitlements` to a NOT-NULL `game_id`. Streams are first-class
addressable media resources; a game MAY have zero, one, or many streams
via `stream_assignments`. Entitlements gate `stream_id`; `game_id` is a
nullable legacy column retained for backward compatibility only.

Forbidden patterns (CI will block):

```sql
-- â BANNED â cements the coupling we removed.
ALTER TABLE streams ADD COLUMN game_id uuid NOT NULL;
ALTER TABLE stream_entitlements ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE stream_assignments ALTER COLUMN game_id SET NOT NULL;
```

```ts
// â BANNED â reading games.stream_url from worker/frontend paths.
const url = game.stream_url;
```

Do instead:

```ts
// â CORRECT â resolve via stream_assignments / streams.
const { data } = await admin
  .from("stream_assignments")
  .select("streams(stream_url, source_platform)")
  .eq("game_id", gameId)
  .eq("is_active", true)
  .maybeSingle();
```

Before modifying any stream/ppv/entitlement code, **read**
[`docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md`](docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md).

This rule is enforced by:

- **CI AST gate** (`.github/workflows/stream-contract-gate.yml`) â pglast
  parser scans migration diffs for forbidden `NOT NULL` on `game_id`.
- **Armageddon test battery** (`src/test/armageddon-stream-invariants.test.ts`).
- **Vitest chaos battery** (`src/test/stream-chaos-battery.test.ts`).
- **Sentry alert** on `stream.access.v2` error rate > 0.1%.

### 5. Live Player Invariants — do not regress v1.4.0

The live-stream player (`src/components/LiveStreamPlayer.tsx`) is the
**single most regression-prone surface in the app**. v1.4.0 hardened it
after a five-incident cascade. The invariants below MUST hold:

#### 5.1 — Layout: never combine `absolute` with `relative` on the player wrapper

The Gate-2 wrapper must be:

```tsx
// CORRECT
<div className="absolute inset-0 flex flex-col z-0">
```

```tsx
// BANNED — Tailwind emits position:relative last; the wrapper drops
// out of its absolute-positioned ancestor, the iframe collapses to
// min-height, and the controls bar floats mid-canvas above empty space.
<div className="absolute inset-0 flex flex-col relative z-0">
```

`z-0` alone gives an absolute element its own stacking context.

#### 5.2 — Timers: every `setTimeout` / `setInterval` must be cleared on unmount

Both the **6-hour session-cap timer** and the **3-second auto-retry timer**
previously leaked closures for up to six hours after navigation. Every
new timer in the player MUST:

1. Capture the handle in a ref (component-scope) or local var (effect-scope).
2. Clear it in the effect cleanup (`return () => { ... }`).
3. Clear it before scheduling a replacement (no overlapping timers).

Pattern reference: `hardCapTimerId` and `autoRetryTimerRef` in `LiveStreamPlayer.tsx`.

#### 5.3 — Unembeddable URLs must bail before ReactPlayer mounts

Provider types that cannot play through ReactPlayer under our locked-down CSP
MUST short-circuit in `StreamPlayer` before ReactPlayer mounts:

| Type | Handling |
|---|---|
| `rtmp` | Advisory panel — browsers cannot decode RTMP. |
| `facebook` | **`plugins/video.php` iframe** — no FB SDK; `frame-src` allows `facebook.com`; `connect.facebook.net` remains blocked in `script-src`. |
| `kick`, `instagram`, `x-spaces` | Advisory panel — no public embed surface compatible with our CSP. |

Forbidden:

```ts
// BANNED — lets ReactPlayer mount, FB SDK trips CSP, FilePlayer
// fall-through reports "no supported sources" with no admin hint.
<ReactPlayer url={facebookUrl} />
```

Required:

```ts
// CORRECT — short-circuit before mount; Facebook rendered via sandboxed iframe.
if (isFacebook) return <FacebookIframeEmbed url={url} />;
```

#### 5.4 — `react-player` must be lazy-loaded

```ts
// CORRECT — each provider is a separate dynamic chunk; FB code
// never executes unless an FB URL is rendered (it isn't, per 5.3).
import ReactPlayer from 'react-player/lazy';
```

The bare `react-player` import is **lint-blocked** by
`no-restricted-imports` in `eslint.config.js`. Do not bypass.

### 6. Broadcast & Paywall System — single oracle, server-side gating

The broadcast/paywall system was hardened in PR #461 (and audited in PR
#462). Two latent bugs from #461 were fixed in migration
`20260504100000_hotfix_broadcast_paywall_audit.sql`. **Read both before
editing any of: `get_active_broadcast`, `redeem_ppv_invite`,
`create_stream_entitlement`, `can_user_view_stream`, `PaywallGate`,
`Live.tsx` broadcast query, or any `ppv_invites`/`stream_entitlements`
schema.**

#### 6.1 — `get_active_broadcast()` is the SINGLE access oracle

Non-admin clients MUST resolve broadcast state via the
`get_active_broadcast()` RPC. It returns:

```ts
{
  is_live:          boolean,
  stream_url:       string | null,  // null unless user may watch
  title:            string | null,
  active_game_id:   string | null,
  live_started_at:  string | null,
  requires_payment: boolean,        // show paywall (registered, no access)
  is_subscribed:    boolean,
  has_entitlement:  boolean,
  user_registered:  boolean,
}
```

**Forbidden:**

```ts
// BANNED — bypasses server-side stream_url gating; lets unpermitted
// users see the URL in dev tools and download the broadcast.
const { data } = await supabase
  .from('stream_admin_config')
  .select('collection_id')
  .single();
const url = data.collection_id;
```

**Required:**

```ts
// CORRECT — server decides whether to send the URL.
const { data: broadcast } = await supabase.rpc('get_active_broadcast');
if (broadcast.stream_url) play(broadcast.stream_url);
else if (broadcast.requires_payment) showPaywallGate();
```

Super-admin is the only role that may read `stream_admin_config.collection_id`
directly (via `fetchAdminStreamConfig`) for the broadcast control panel.

#### 6.2 — `can_user_view_stream` argument order: `(text, uuid)`

The published signature (per migration `20260402120000_ppv_invites_relax_game_id.sql`)
is `(p_game_id text, p_user_id uuid)`. **Multiple overloads exist** (the
older `(uuid, uuid)` from core_schema is still in the catalog).

Always use **named arguments** when calling from PL/pgSQL:

```sql
-- CORRECT
public.can_user_view_stream(
  p_game_id => v_game_id::text,
  p_user_id => v_user_id
);

-- BANNED — positional args silently bind to the wrong overload or
-- raise "function does not exist" at runtime (only when active_game_id
-- is set, which CI never exercises).
public.can_user_view_stream(v_user_id, v_game_id);
```

This was bug #1 of the post-merge audit.

#### 6.3 — `ppv_invites.game_id` is TEXT — never cast unconditionally

Per migration `20260402120000_ppv_invites_relax_game_id.sql`, the column
is `text` and may legitimately hold the literal string `'broadcast'` for
open-broadcast comp codes (admin generates them with no game bound).
`stream_entitlements.game_id` is still `uuid`.

**Forbidden:**

```sql
-- BANNED — throws invalid_text_representation for 'broadcast'.
SELECT public.create_stream_entitlement(
  v_invite.game_id::uuid,  -- explodes
  ...
);
```

**Required pattern** (used in `redeem_ppv_invite`):

```sql
DECLARE
  v_game_uuid       uuid;
  v_is_uuid_game_id boolean := false;
BEGIN
  v_game_uuid := v_invite.game_id::uuid;
  v_is_uuid_game_id := true;
EXCEPTION WHEN others THEN
  v_is_uuid_game_id := false;
END;

IF v_is_uuid_game_id THEN
  -- game-bound flow: create entitlement
ELSE
  -- open-broadcast flow: mark consumed, no entitlement row
END IF;
```

This was bug #2 of the post-merge audit.

#### 6.4 — `entitlement_status = 'active'` (never `'purchased'`)

`can_user_view_stream` filters on `status = 'active'`. The original
`create_stream_entitlement` inserted `'purchased'` — every PPV purchase
was silently rejected. Fixed in migration `20260504000200`. If you add a
new path that creates an entitlement, insert `'active'`.

The `'purchased'` value still exists in the enum for historical rows;
do **not** drop it (would require backfill + downtime).

#### 6.5 — Fan onboarding never sets `bio` or `avatar_url`

Use `complete_fan_onboarding(p_display_name, p_full_name, p_preferred_league)`
RPC. The function deliberately omits `bio` and `avatar_url` from its
INSERT/UPDATE. The `Onboarding.tsx` page hides those form fields when
`isFan === true`. Players and coaches still use `saveOnboarding()` which
collects bio + avatar.

If you add a fan-side form anywhere, **never** prompt for bio or avatar.
Do **not** call `saveOnboarding()` from a fan code path — it would write
empty strings or null overrides into player-only columns.

#### 6.6 — Admin `Go Live` MUST sync stream_sessions + stream_sources

The admin overlay's `handleGoLive()` writes `stream_admin_config` first
(unchanged), THEN calls `admin_sync_broadcast_to_sessions()` so the
viewer-facing tables have rows. Removing the second call recreates
bug A4/A5 (stream_sessions / stream_sources empty → viewer queries
return empty even after RLS fixes).

The sync call is intentionally non-fatal (try/catch) so a transient
sync failure cannot roll back the primary go-live action.

#### 6.7 — Paywall fallback game must honor server-granted access

`fallbackBroadcastGame` in `Live.tsx` activates when the camera-only
broadcast is live but no real game row exists. It MUST honor BOTH:

1. The legacy `hasBroadcastFallbackAccess` (privileged role check), AND
2. `broadcast?.stream_url != null` (server has granted access via
   `get_active_broadcast`).

Without #2, registered fans whose access was just granted server-side
see "No Active Broadcast" because `useLiveAccess` returns `'paywall'`
for broadcasts with no `active_game_id`. This was bug #3 of the audit.

#### 6.8 — `?intent=fan` must survive sign-in round-trips

The fan paywall flow depends on `?intent=fan` reaching `/onboarding` so
the form hides bio/avatar. Three round-trip points must preserve it:

| Surface | Where preserved |
|---|---|
| Anon paywall click → onboarding | `PaywallGate.onWatchClick` → `/onboarding?intent=fan&redirect=/live` |
| Onboarding (unauthenticated) → login | `Onboarding.tsx` Navigate URL embeds `intent` + `redirect` |
| Login (post-signin) → onboarding | `Login.tsx` `useEffect` reads `intentParam` and forwards |
| Google OAuth callback → app | `Login.tsx` `redirectTo` carries `intent` + `redirect` back to `/login` |

This was bug #4 of the audit (Google OAuth path was missed in PR #461).

#### 6.9 — Worker endpoints MUST mirror the DB oracle for open broadcasts (M-01)

**Root cause (M-01 audit, 2026-05-06):** `get_active_broadcast()` correctly
grants registered fans access to an open (camera-only) broadcast and returns
`stream_url`. But two worker endpoints independently denied those same fans,
producing a blank player screen with no error — the worst kind of silent
failure.

**`handleStreamAccess` (`GET /api/streams/broadcast/access`)**

For `gameId === 'broadcast'` do **not** call `can_user_view_stream`. That
function looks for `stream_entitlements` / `ppv_invites` rows, which do not
exist for registration-based open broadcasts.

```ts
// BANNED — silently returns { hasAccess: false } for all registered fans
// on open broadcasts because no entitlement row exists.
const result = await can_user_view_stream('broadcast', userId);
return { hasAccess: result };

// CORRECT — mirrors the DB oracle: any registered fan may watch.
if (gameId === 'broadcast') {
  const { data: cfg } = await admin.from('stream_admin_config').select('is_live').single();
  if (!cfg?.is_live) return { hasAccess: false };
  const { data: profile } = await admin.from('profiles')
    .select('onboarding_completed_at').eq('id', userId).single();
  return { hasAccess: profile?.onboarding_completed_at != null };
}
```

**`handlePlaybackSession` (`POST /api/streams/broadcast/session`)**

For `gameId === null` (the broadcast alias path), the privileged-role check
(`roles.includes('player') || roles.includes('paid_fan')`) is insufficient —
it excludes all regular registered fans.

```ts
// BANNED — hasAccess remains false for regular registered fans.
const hasAccess = hasPrivilegedRole;

// CORRECT — also grant access to registered fans (mirrors DB oracle).
const { data: profile } = await admin.from('profiles')
  .select('onboarding_completed_at').eq('id', userId).single();
const isRegisteredFan = profile?.onboarding_completed_at != null;
const hasAccess = hasPrivilegedRole || isRegisteredFan;
```

**Known tech debt (S1 — LOW):** `useLiveAccess.ts` reads `stream_admin_config`
directly at line 39 to obtain `active_game_id`. Per rule 6.1 this should come
from `get_active_broadcast()`, which already returns `active_game_id`. The hook
is chrome-only (guarded by `Live.tsx:1458`) so it is low risk, but it is a
tracked contract violation.

**Regression tests:** `src/test/worker-stream-hardening.test.ts` — 5 tests
covering the broadcast alias access paths for both handlers.

### Enforcement (all run in CI on every PR)

- **Source-level regression tests**:
  `src/test/live-stream-player-regressions.test.ts` (11 assertions,
  one per invariant above; mutation-tested).
- **Worker broadcast access tests**:
  `src/test/worker-stream-hardening.test.ts` (5 assertions for the open
  broadcast / `gameId === 'broadcast'` paths in `handleStreamAccess` and
  `handlePlaybackSession`).
- **Pipeline simulation**: `npm run simulate:broadcast` walks 19
  representative URLs through the full ingest pipeline. Add a scenario
  to `scripts/simulate-broadcast.ts` whenever you add a new provider
  type or a new branch in `StreamPlayer`.
- **ESLint** (`no-restricted-imports`): blocks bare `react-player`.
- **Vitest**: `src/test/live-page-*.test.tsx` covers each access-gate path.
- **Stream independence AST gate**: `.github/workflows/stream-contract-gate.yml`
  blocks any migration that adds `NOT NULL` to `game_id` on streams /
  stream_assignments / stream_entitlements.

If a regression test fails on your branch, **read the failing assertion**.
Each one maps to a real production incident from v1.3.x. Disabling the
test is never the right answer.

## §8 OmniBridge — APEX-OmniHub Integration (DO NOT DRIFT)

This section documents the bidirectional sync bridge between SBBL-HQ and
APEX-OmniHub, merged in PR #502. All rules below are permanent. Agents
MUST read this section before touching any code in or adjacent to
`handleOmnihubWebhook`, `handleOmniportCommand`, `deliverSyncEnvelope`,
or `handleSyncDrain`.

### 8.1 — New endpoints (PR #502)

#### `POST /webhooks/omnihub` — `handleOmnihubWebhook`

Inbound command receiver from the APEX-OmniHub control plane.

**Authentication:** HMAC-SHA256 via `OMNIHUB_VERIFY_KEY` (falls back to
`OMNIHUB_SIGNING_SECRET` in dev/staging when `OMNIHUB_VERIFY_KEY` is
absent). Clock-skew window: ±300 seconds.

**Envelope shape:**

```ts
{
  packet: SyncPacket,
  signature: base64url(HMAC-SHA256(secret, JSON.stringify(packet)))
}
```

Required inbound headers:
- `X-Omni-Source` — must equal `"sbbl-hq"` (`target_source` pin)
- `X-Omni-Signature` — base64url HMAC-SHA256 of the serialized packet
- `X-Omni-Packet-Id` — used as the idempotency key stored in `api_idempotency_keys`
- `X-Omni-Trace-Id` — propagated in logs and audit records

**9-action allowlist** (HARD RULE — no additions without repo owner approval):

```
disable_stream
enable_stream
revoke_access
grant_access
emergency_halt
broadcast_message
force_man_review
hotfix_dispatch
ping
```

Any action not on this list is rejected with `400 action_not_allowed`.

**Risk-lane re-classification:** Payloads whose content matches
BLOCKED-lane patterns (e.g., `DROP TABLE`, `ALTER ROLE`, `DISABLE RLS`,
`TRUNCATE`, `GRANT ALL PRIVILEGES`) are rejected even if the HMAC
signature is valid. This check runs BEFORE any action dispatch.

**Idempotency:** The `X-Omni-Packet-Id` value is stored in
`api_idempotency_keys` on first processing. Replayed packet IDs return
`200 already_processed` without re-executing the action.

**Audit:** Every accepted command is written via `log_admin_action` RPC.

#### `POST /api/omniport/command` — `handleOmniportCommand`

JWT-authenticated diagnostic surface for OmniHub operator sessions.

**Authentication:** Standard Supabase JWT (`requireAuth`). No HMAC.

**Supported commands:**

| Command | Description |
|---|---|
| `PING` | Liveness check — returns `{ ok: true, ts: <ISO timestamp> }` |
| `ECHO` | Returns the request payload verbatim |
| `HEALTH_CHECK` | Returns worker health snapshot |
| `TELEMETRY_SNAPSHOT` | Returns recent QoE/telemetry metrics |

Any other command returns `400 unsupported_command`.

### 8.2 — Outbound sync: `handleSyncDrain` + `deliverSyncEnvelope`

`handleSyncDrain` (`POST /sync/drain`) sends a canonical envelope to
`OMNIHUB_SYNC_URL`:

```ts
// Envelope shape
{ packet: SyncPacket, signature: base64url(HMAC-SHA256(OMNIHUB_SIGNING_SECRET, JSON.stringify(packet))) }

// Required outbound headers
X-Omni-Source:     "sbbl-hq"
X-Omni-Signature:  <base64url HMAC>
X-Omni-Packet-Id:  <packet.id>
X-Omni-Trace-Id:   <trace id>
```

`deliverSyncEnvelope()` implements a 4-attempt exponential-backoff
delivery loop:

| Attempt | Delay before retry |
|---|---|
| 1 (initial) | — |
| 2 | 250 ms |
| 3 | 1 s |
| 4 | 4 s |

Per-attempt timeout: 5 seconds. 4xx responses are treated as fast-fail
(non-retryable target rejection — do not retry on client errors).

### 8.3 — Required Cloudflare Worker secrets

| Secret | Purpose |
|---|---|
| `OMNIHUB_SIGNING_SECRET` | HMAC key used to sign outbound sync envelopes (required) |
| `OMNIHUB_SYNC_URL` | OmniHub endpoint to deliver outbound packets (required) |
| `OMNIHUB_VERIFY_KEY` | HMAC key used to verify inbound OmniHub commands (production) |

**Fallback rule:** When `OMNIHUB_VERIFY_KEY` is absent (dev/staging),
the worker falls back to `OMNIHUB_SIGNING_SECRET` as the verification
key. This allows a shared-secret dev/staging setup without requiring a
separate key pair.

### 8.4 — HARD RULES (enforce in every review)

- **NEVER** bypass the 9-action allowlist. If a new action is needed,
  add it explicitly to the allowlist with repo owner approval.
- **NEVER** skip the idempotency check. Every inbound OmniHub command
  must be checked against `api_idempotency_keys` before execution.
- **NEVER** skip the HMAC verify step. A missing or invalid
  `X-Omni-Signature` must always result in a `401` rejection, regardless
  of the command.
- **NEVER** process a BLOCKED-lane payload even if the signature is
  valid. Risk-lane rejection happens before action dispatch.
- **NEVER** remove or weaken the `target_source === "sbbl-hq"` pin.

### 8.5 — Integration tests

`src/worker/tests/omnihub-bridge.integration.test.ts` — 14 tests
covering all new/changed surfaces:

- Header presence validation
- Signature failure rejection
- Target mismatch (`target_source` pin)
- Clock-skew rejection (>300 s)
- Valid `ping` dispatch
- BLOCKED payload rejection
- Replay dedup (idempotency)
- 401 unauthenticated
- PING command
- Unsupported command
- HEALTH_CHECK
- Sync drain envelope shape
- 5xx retry (backoff triggered)
- 4xx fast-fail (no retry)

All 14 tests must pass before merging any change to OmniBridge surfaces.

---

### 7. Broadcast Stream Independence — HARD FREEZE, DO NOT TOUCH

**This is a hard owner rule. The broadcast stream is a standalone media
resource owned exclusively by the operator. It is NEVER tied to a game,
a PPV entitlement, or any other entity.**

The following invariants are permanent. No agent, PR, or migration may
violate them without explicit written approval from the repo owner:

#### 7.1 — `/api/broadcast/*` is frozen to agents

The route family `POST /api/broadcast/access`, `POST /api/broadcast/session`,
`POST /api/broadcast/session/heartbeat`, and `POST /api/broadcast/session/end`
are **off-limits for modification** unless the repo owner explicitly directs
a change. Do not:

- Add `game_id`, `gameId`, or any game parameter to these routes.
- Add PPV, entitlement, or invite-code logic to these routes.
- Rename or move these routes.
- Add authentication layers beyond the existing `requireAuth`.

#### 7.2 — Broadcast access = registration only

The only requirement to watch a broadcast is a completed SBBL HQ account
(`onboarding_completed_at IS NOT NULL`). There is no PPV, no game
entitlement, no `can_user_view_stream` call, and no `stream_entitlements`
row involved. This is intentional.

#### 7.3 — `LiveStreamPlayer` must route `game.id === 'broadcast'` to `/api/broadcast/*`

When `game.id === 'broadcast'`, all session API calls in `LiveStreamPlayer.tsx`
MUST target the canonical broadcast endpoints:

```ts
// CORRECT
const endpoint = game.id === 'broadcast'
  ? '/api/broadcast/session'
  : `/api/streams/${game.id}/session`;
```

Do NOT route the broadcast alias through `/api/streams/broadcast/*`. The
legacy alias routes exist only for backward compatibility and are not
guaranteed to remain.

#### 7.4 — No further modifications without owner approval

If you are an agent reading this: **stop**. Do not plan, propose, or
implement any change to the broadcast stream system unless the operator
has explicitly asked for it in this session. Adding "improvements",
"additional access control", or "game-binding features" to the broadcast
path will break live events and is not authorized.

## Architecture at a glance

```
React (src/)
  âââ src/pages/**             â page-level components; fetch via react-query
  âââ src/components/**        â shared UI; never fetch directly
  âââ src/lib/api/**           â thin API client wrappers
  âââ src/lib/leagues.ts       â LEAGUE_REGISTRY (canonical branding)

Cloudflare Worker (src/worker/index.ts, src/worker/routes/*)
  âââ requireAuth(req)          â throws on missing x-sbbl-user-id-verified
  âââ admin = getAdminClient()  â Supabase service-role
  âââ route table at bottom     â append new routes here

Supabase
  âââ tables                    â players, teams, games, leagues, seasons,
  â                               player_game_stats, store_products,
  â                               media_publications, â¦
  âââ RPCs                      â get_stats_dashboard, get_leaderboards,
  â                               mark_order_paid, finalize_game_stats, â¦
  âââ migrations                â supabase/migrations/*.sql (date-prefixed)
```

Data flow for any page:

1. Page calls `useQuery(apiFetch('/api/public/X'))`.
2. Worker handler runs Supabase query (service role â RLS-free).
3. Handler returns `{ ok, data }` with edge cache headers.
4. Page renders the array. Empty = visible empty state.

## Skills & Commands

This project includes 7 APEX skills and 1 project context profile in
`.claude/skills/`. Each skill has YAML frontmatter with `name`,
`description`, and `triggers` for auto-discovery. See
[`.claude/README.md`](.claude/README.md) for the full skill map.

**Available slash commands:**
- `/project:apex-power` — Activate APEX-POWER-20X execution protocol
- `/project:debug` — Activate 8-phase debug protocol
- `/project:qa-gate` — Run zero-trust QA verification matrix

**Skill hierarchy:**
```
apex-power (meta-skill) → omnidev-v2 | apex-master-debug | apex-frontend
                        → apex-omnitest | apex-memory | apex-qa
sbbl-agent (project context) → domain awareness for all skills
```

## Common tasks

### Add a new public data surface

1. **Worker**: add a handler in `src/worker/index.ts` (no `requireAuth`);
   register in the route table; set `Cache-Control` to
   `public, s-maxage=30, max-age=15` (or similar).
2. **API client**: add the wrapper in `src/lib/api/public.ts`.
3. **Page**: fetch via `useQuery`; no fallback; render empty state.
4. **Docs**: add the endpoint to
   `docs/protocols/no-mock-in-production.md`.

### Modify a Supabase RPC

1. Add a new dated migration under `supabase/migrations/` (NEVER edit
   an existing one â they are immutable once merged).
2. Update the worker handler if the response shape changes.
3. Update the frontend type and its consumers.

## Validation gates (all required green)

```
npm run typecheck   # strict TS across app + node configs
npm run lint        # ESLint with zero-warning policy
npm test            # vitest unit+integration suite
npm run build       # production build (vite)
```

CI runs all of these. Do not merge red.

## Incident history (relevant to this guide)

- **2026-05-06** — M-01: Open broadcast fan-view gap. Registered fans who
  passed the `get_active_broadcast()` oracle (which correctly returned
  `stream_url`) still saw a blank player because two worker endpoints
  independently denied them: `handleStreamAccess` called
  `can_user_view_stream('broadcast', userId)` (no entitlement rows exist for
  registration-based open broadcasts → always `false`); `handlePlaybackSession`
  gated on `hasPrivilegedRole` (player/paid_fan only). Both handlers were fixed
  to mirror the oracle — grant access to any user whose
  `profiles.onboarding_completed_at IS NOT NULL`. See rule **6.9** and
  `src/test/worker-stream-hardening.test.ts`.


- **2026-04-16** â Live data regression. Store/Leaderboards/Scores/
  Stats/Live silently showed mock data because
  `/api/stats` + `/api/leaderboards` required auth but the public pages
  called them anonymously, and every page had a `|| mockX` fallback.
  Fix: made `/api/stats` tier-aware (anonymous callers get limited data,
  no 401); added explicit login-gate UI in Leaderboards for unauthenticated
  visitors; purged all mock fallbacks from production pages; installed ESLint
  + vitest guardrails (this guide). See
  [`docs/protocols/no-mock-in-production.md`](docs/protocols/no-mock-in-production.md)
  for details.

---

Last verified: 2026-05-11
