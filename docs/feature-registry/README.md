# SBBL-HQ Feature Registry

## Purpose

This registry organizes the audited live-video product surface into production ownership areas. It is focused on end-user and operator features that support stream discovery, access, playback, commerce, telemetry, engagement, and administration.

## System Entry Points

| Surface | Route / Module | Responsibility |
| --- | --- | --- |
| Live viewer page | `src/pages/Live.tsx` | Main game broadcast experience: stream status polling, admin broadcast controls, chat, reactions, fan tokens, biometrics, Mic Up overlays, preflight, and live player composition. |
| Live player | `src/components/LiveStreamPlayer.tsx` | Access gates, session lifecycle, playback URL resolution, provider routing, heartbeat handling, invite generation, PPV checkout entry, watermarking, and player controls. |
| WHEP player | `src/components/WhepPlayer.tsx` | Low-latency WebRTC playback, CORS probing, ICE recovery, retry/backoff, and manual reconnect. |
| Stream API client | `src/lib/api/stream.ts` | Frontend client for public status, sessions, comments, moderation, stream config, go-live, comp-code, and invite redemption APIs. |
| Worker stream backend | `src/worker/index.ts` | Authenticated stream sessions, entitlement checks, one-device enforcement, heartbeat batching, signed playback, public status, chat, reactions, Stripe checkout, and ops routes. |
| StreamForge telemetry | `src/hooks/use-streamforge.ts`, `src/lib/stream/streamforge.ts`, `src/lib/stream/qoe-beacon.ts` | Anonymous QoE state machine, network profile observation, health scoring, preconnect hints, and beacon transport. |
| WHIP ingest | `src/hooks/use-whip-ingest.ts` | Browser-origin ingest for admin local-file/camera broadcast into MediaMTX/stream origin. |
| Viewer preflight | `src/components/preflight/*`, `src/lib/api/preflight.ts` | Feature-flagged viewer readiness checks before playback. |
| Paywall/access | `src/components/live/PaywallGate.tsx`, `src/hooks/useLiveAccess.ts`, stream worker access routes | Server-oracle access decisions, entitlement display, and paywall state. |

## Feature Inventory

### 1. Live Broadcast Discovery

**Code owners / modules**

- `src/pages/Live.tsx`
- `src/lib/api/public.ts`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`

**Runtime behavior**

1. `/live` loads public home data and selects the current live game or next upcoming game for non-admin viewers.
2. Super admins fetch full stream config from `/ops/streams/config`.
3. Non-admin viewers poll `/api/streams/status` and the active-broadcast oracle.
4. The selected game is passed into `LiveStreamPlayer` as the playback target.

**Key invariants**

- Non-admin viewers do not receive raw stream URLs from the broadcast oracle unless the server has granted access.
- Admin config treats `stream_admin_config.collection_id` as the stream URL field.
- Status polling is intentionally periodic, not realtime, to reduce backend churn.

### 2. Access Control and Paywall

**Code owners / modules**

- `src/components/LiveStreamPlayer.tsx`
- `src/components/live/PaywallGate.tsx`
- `src/hooks/useLiveAccess.ts`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`

**Runtime behavior**

1. Anonymous viewers see a register/sign-in gate.
2. `player`, `paid_fan`, and `super_admin` roles receive role access.
3. Fans without role access call `/api/streams/:gameId/access` or `/api/broadcast/access`.
4. Access can be granted by PPV entitlement, invite redemption, comp code, or server-granted broadcast oracle.
5. Fans without access see preview + checkout + access-code redemption.

**Key invariants**

- Client role state is presentation logic only; worker routes verify auth and server-side roles/entitlements.
- Invite/comp-code redemption is server-side, Turnstile-aware, IP-locked, single-use, and error-code mapped in the UI.
- Super admins bypass paywall/session displacement for operations monitoring.

### 3. Playback Session Lifecycle

**Code owners / modules**

- `src/components/LiveStreamPlayer.tsx`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`

**Runtime behavior**

1. Access-granted viewers create a session through `/api/streams/:gameId/session` or `/api/broadcast/session`.
2. The frontend supplies a stable per-device session key based on a local device token.
3. The worker displaces other active sessions for the same user/game unless the user is super admin.
4. Heartbeats renew the short session expiry while respecting the hard max expiry.
5. The frontend ends the session on unmount.

**Key invariants**

- Session expiry is short-lived and heartbeat-driven.
- Session max duration is hard-capped by the worker and mirrored in the frontend hard-cap timer.
- Displaced viewers receive heartbeat failure and see the one-device overlay.
- Heartbeats are batch-flushed by the worker to protect Supabase under high concurrency.

### 4. Playback Provider Routing

**Code owners / modules**

- `src/components/LiveStreamPlayer.tsx`
- `src/components/WhepPlayer.tsx`
- `src/lib/stream/url-detector.ts`
- `src/lib/stream/youtube-url.ts`
- `src/lib/playback/*`

**Provider matrix**

| Provider / URL type | Runtime path | Behavior |
| --- | --- | --- |
| WHEP | `WhepPlayer` | Low-latency WebRTC playback with CORS probe, retry/backoff, ICE recovery, and offline/error states. |
| HLS / DASH / direct file | `ReactPlayer` file config | Forces HLS/DASH where detected and sets CORS credentials only for SBBL proxy-authenticated URLs. |
| YouTube | `ReactPlayer` YouTube config | Uses explicit origin, hides provider controls where possible, and maps YouTube error codes. |
| Twitch | `ReactPlayer` Twitch config | Requires explicit user gesture, complete parent domain list, and no iframe click-blocker overlay. |
| Vimeo | `ReactPlayer` | Uses standard iframe path with click-through blocker. |
| Facebook | Direct plugin iframe | Avoids loading the Facebook SDK and uses `plugins/video.php`. |
| RTMP | Advisory overlay | Browser-incompatible; directs operators to use HLS. |
| Kick / Instagram / X Spaces | Advisory overlay | Not treated as embeddable; directs operators to supported sources. |

**Key invariants**

- Provider behavior is derived from normalized URL type and optional upstream provider hint.
- Twitch player mount is delayed until the container is sized and visible.
- Proxy-authenticated URLs attach credentials; public CDN URLs do not.

### 5. Admin Broadcast Controls

**Code owners / modules**

- `src/pages/Live.tsx`
- `src/hooks/use-whip-ingest.ts`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`

**Runtime behavior**

1. Super admins can edit stream title and stream URL from the live page overlay.
2. Go Live uses the atomic `/ops/streams/go-live` endpoint to avoid split-write race windows.
3. Admins can preview a local file through a blob URL.
4. Admins can broadcast local-file or camera streams through WHIP ingest to the stream origin.
5. Admins can generate comp codes for a game or broadcast alias.

**Key invariants**

- Blob URLs are revoked when replaced or when the component unmounts.
- Camera/file media tracks are stopped when broadcast stops or component unmounts.
- Atomic go-live updates stream config and live status together.

### 6. Live Engagement

**Code owners / modules**

- `src/pages/Live.tsx`
- `src/components/CheerMeter.tsx`
- `src/lib/api/reactions.ts`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`

**Feature set**

- Fire/heart/clap reactions.
- Aggregate cheer meter.
- Live chat with active-session requirement.
- Moderator hide/restore for chat messages.
- Reaction reset for moderators.
- Clip and share controls.

**Key invariants**

- Chat posting requires an active playback session.
- Chat has user and IP shared rate limits.
- The placeholder `broadcast` game ID is skipped for game-specific cheer-meter paths.

### 7. Fan Tokens

**Code owners / modules**

- `src/pages/Live.tsx`
- `src/components/tokens/*`
- `src/lib/api/tokens.ts`
- `src/hooks/useTokenLeaderboardRealtime.ts`
- `src/worker/routes/tokens.ts`

**Feature set**

- Wallet badge.
- Token purchase modal.
- Awardable player panel.
- Token leaderboard.
- Realtime leaderboard updates.

**Key invariants**

- Fan-token UI is feature-flagged.
- Purchases route through backend-created checkout sessions.
- Awarding and leaderboard views stay scoped to active game context.

### 8. Biometrics

**Code owners / modules**

- `src/components/biometrics/*`
- `src/hooks/useBiometricRealtime.ts`
- `src/lib/api/biometrics.ts`
- `src/worker/routes/biometrics.ts`

**Feature set**

- Fresh player biometric snapshots.
- Heart-rate display.
- Stamina bar.
- Fatigue indicator.
- Dual 1v1/2v2 video overlay.
- Admin biometric panel.

**Key invariants**

- Biometric overlays render nothing unless fresh data exists.
- Latest endpoint returns latest-per-player by pulling a bounded recent window and deduplicating in-worker.
- Feature is controlled by biometric feature flags.

### 9. Mic Up Series

**Code owners / modules**

- `src/components/micup/*`
- `src/pages/Live.tsx`
- `src/lib/feature-flags.ts`

**Feature set**

- Intro sting.
- Lower third.
- Series badge.
- Trash-talk banner.

**Key invariants**

- Mic Up surfaces are feature-flagged.
- These are video-overlaid engagement modules, not playback providers.

### 10. Viewer Preflight

**Code owners / modules**

- `src/components/preflight/*`
- `src/lib/preflight/*`
- `src/lib/api/preflight.ts`
- `src/worker/index.ts`

**Feature set**

- Event card.
- Check items.
- Remediation guidance.
- Basketball pulse loader.
- Backend preflight snapshot.

**Key invariants**

- Preflight is read-only and should not create sessions or mutate entitlements.
- It is designed to prevent fan-facing failure immediately before playback.

### 11. StreamForge QoE

**Code owners / modules**

- `src/hooks/use-streamforge.ts`
- `src/lib/stream/streamforge.ts`
- `src/lib/stream/qoe-beacon.ts`
- `src/worker/routes/stream-qoe.ts`

**Feature set**

- QoE snapshot reducer.
- Startup/rebuffer/error/network health score.
- Browser network profile observation.
- Preconnect hint injection.
- Anonymous beacon delivery.
- Edge health aggregation.

**Key invariants**

- Telemetry never blocks or mutates playback.
- Beacon transport omits credentials and carries no user ID/JWT.
- Placeholder `broadcast` is not telemetry-routable.
- Payload size is bounded.

### 12. Commerce and Entitlements

**Code owners / modules**

- `src/components/LiveStreamPlayer.tsx`
- `src/pages/Billing.tsx`
- `src/lib/api/stream.ts`
- `src/worker/index.ts`
- `src/worker/stripe-utils.ts`

**Feature set**

- PPV checkout entry.
- Stripe checkout session handling.
- Entitlement creation/lookup.
- Replay entitlement hooks.
- Billing surfaces.

**Key invariants**

- Checkout starts server-side.
- Entitlement checks are server-side.
- Live and replay entitlements are treated as distinct gates where replay mode is in use.
