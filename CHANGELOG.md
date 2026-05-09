<!-- Version: v1.4.0 | Date: 2026-04-29 | Status: Current -->
# CHANGELOG

All notable changes to SBBL HQ are documented in this file.
Versioning follows [semantic versioning](https://semver.org) with UTC date stamps.

---

## 2026-05-04 — v1.4.1 — Facebook Live playback via iframe embed

- **Facebook URLs now play** via the official `plugins/video.php` sandboxed iframe.
  Paste a `facebook.com/…/videos/…` or `fb.watch` URL into Broadcast Controls and
  it renders immediately — no SDK, no CSP violation, no advisory.
- **CSP** (`src/worker/index.ts`): `https://www.facebook.com` added to `frame-src`
  only. `connect.facebook.net` remains absent from `script-src` permanently.
- **Invariant preserved**: `isFacebook` early-return in `LiveStreamPlayer.tsx`
  is unchanged — ReactPlayer never sees a Facebook URL.
- **Tests updated**: `live-stream-player-regressions.test.ts` now asserts
  `plugins/video.php` iframe + `encodeURIComponent(url)`; `worker-ops-health.test.ts`
  asserts FB SDK blocked + `frame-src` allows `facebook.com`.

---

## 2026-04-29 — v1.4.0 — Live Player Hardening (BASELINE REFERENCE BUILD)

> **This is the canonical baseline build for the live-stream player.**
> Onboarding agents and devs MUST read this entry, the Live Player
> Invariants section in `CLAUDE.md`, and the runbook at
> `ops/runbooks/universal-ingest.md` before touching anything in
> `src/components/LiveStreamPlayer.tsx` or `src/lib/stream/`.

Closes a five-incident cascade caused by stale/invisible regressions in
the broadcast surface: a half-rendered player container, two orphaned
timers leaking the heartbeat closure for up to six hours, and a
silent CSP-trip on Facebook URLs that surfaced as a generic
"no supported sources" error with no admin-actionable hint.

### What landed

- **Layout fix** (`820949e`). Removed the conflicting
  `absolute inset-0 flex flex-col relative z-0` Tailwind classes on the
  Gate-2 wrapper of `LiveStreamPlayer.tsx`. Tailwind emitted
  `position: relative` last, collapsing the wrapper out of its absolute
  ancestor and rendering the iframe at min-height while the controls
  bar floated mid-canvas above empty black space.
- **Timer hygiene** (`fd4bf71`). The 6-hour session-cap `setTimeout` and
  the 3-second auto-retry `setTimeout` were started without retaining
  their handles. The cap timer pinned the heartbeat closure for up to
  six hours after navigation; the retry timer could call `setPlaying`
  on a torn-down `ReactPlayer`. Both now stored and cleared on unmount.
- **Unembeddable-URL bail** (`0cacfb1`). `StreamPlayer` now short-circuits
  before `ReactPlayer` mounts for `facebook | kick | instagram | x-spaces`
  URLs, mirroring the existing RTMP advisory pattern. ReactPlayer never
  attempts the `connect.facebook.net/sdk.js` load (intentionally blocked
  by CSP since `89d9696`), so the silent `FilePlayer` fall-through into
  "no supported sources" is gone.
- **Regression guards** (`de7c49f`). Added
  `src/test/live-stream-player-regressions.test.ts` — 11 cheap,
  deterministic source-level assertions that lock in every fix above.
  Mutation-tested by re-introducing each bug locally and confirming the
  relevant assertion failed before reverting.
- **Pipeline simulation** (`scripts/simulate-broadcast.ts`). New
  `npm run simulate:broadcast` walks every supported provider type
  (HLS / DASH / MP4 / YouTube / Twitch / Vimeo / WHEP / RTMP / Facebook /
  Kick / Instagram / X-Spaces / blob: / garbage) through the full
  ingest → playback pipeline (`canonicalizeStreamSourceUrl` →
  `detectStreamUrlType` → `toPlayableUrl` → `getStreamDeliveryClass` →
  `StreamPlayer` outcome) and asserts each scenario produces the right
  result. **19 / 19 scenarios pass** at v1.4.0; the script exits non-zero
  on any mismatch and is the canonical baseline reference.

### Validation gates green at release

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` (max-warnings 0) | clean |
| `npm test` | 97 files, 1001 passed / 7 skipped / 0 failed in ~30s |
| `npm run build` | clean (PWA 81 entries / 1.7 MiB) |
| `npm run simulate:broadcast` | 19 / 19 scenarios pass |

### Required reading before changing the player

1. The **Live Player Invariants** HARD RULE in `CLAUDE.md` §1.5.
2. `src/test/live-stream-player-regressions.test.ts` — every assertion
   maps to a real production incident.
3. `ops/runbooks/universal-ingest.md` — the validation checklist.

---

## 2026-04-19 — v1.3.0 — Universal Stream Player, WHIP Ingest, Zero-Friction Broadcast

Closes the "paste any link → plays instantly; drop any local highlight → broadcast
it seamlessly" mandate and turns the admin console into a production-grade
broadcast cockpit.

- **Universal URL detector.** `src/lib/stream/url-detector.ts` now covers
  Twitch, YouTube, Vimeo, Facebook, Kick, Rumble, Dailymotion, X Spaces,
  Instagram Live, HLS (presigned/query-suffixed), DASH, WHEP, RTMP,
  direct MP4/m4v/mov/webm/ogg/ogv (including presigned S3/R2 variants),
  plus new `local` class for `blob:` / `data:video` / `file:` sources.
- **Origin-aware `crossOrigin` on the player.** `LiveStreamPlayer.tsx`
  sends credentialed CORS only to our own `*.sbbl-hq.icu` proxy endpoints
  (so the `sbbl_proxy_auth` cookie reaches hls.js) and anonymous CORS to
  every public CDN. `blob:`/`data:`/`file:` sources omit the attribute
  entirely. Fixes the silent CORS rejection that blocked league-highlight
  MP4s behind public buckets.
- **Twitch parent allow-list widened** to the union of the document host,
  `sbbl-hq.icu`, `www.sbbl-hq.icu`, and `localhost`. Prevents Twitch
  from refusing preview domains or the `www.` variant.
- **Browser-native WHIP ingest.** New `useWhipIngest` hook
  (`src/hooks/use-whip-ingest.ts`) publishes any `MediaStream` to a
  WHIP endpoint with sendonly transceivers, SDP offer/answer handshake,
  Location-header-driven cleanup, optional bearer token, and
  deterministic ICE gather (MediaMTX doesn't trickle). Covered by 6
  vitest cases with a fake `RTCPeerConnection`.
- **AdminStreamOverlay broadcast controls.** `/live` gear menu now has
  `Load Local File`, `Broadcast File` (via `HTMLVideoElement.captureStream()`),
  `Broadcast Camera` (via `navigator.mediaDevices.getUserMedia`), and
  `Stop Broadcast` with a live WHIP status chip. Blob URLs are revoked
  on reselect and on unmount to keep memory flat across admin sessions.
- **Caddyfile `/whip/*` proxy.** `ops/Caddyfile` mirrors the existing
  WHEP listener on MediaMTX port 8889 (WebRTC mux — ingest and egress
  share the same port). Adds OPTIONS preflight + policy headers.
- **Duplicate `containerReady` declaration removed** (TS2451 blocker on
  `LiveStreamPlayer.tsx`). Also collapses the duplicate tap-to-unmute
  overlay that rendered twice.
- **Playwright expect timeout raised** to 15 s in `playwright.config.ts`
  so Vite dev cold-compile on CI stops producing flaky `toBeVisible`
  failures on `/live`. Matches the convention already in
  `critical-paths.spec.ts` and `broadcast-overlay-flow.spec.ts`.
- **Eslint `.claude` ignore.** Subagent worktrees' `dev-dist/workbox-*.js`
  outputs no longer pollute lint reports.

Validation gates on 2026-04-19: typecheck clean · lint 0/0 · vitest
857 passed / 7 skipped / 0 failed · production build 61 s. PR #398 CI:
Unit & Integration Tests, Lint & Typecheck, e2e, Auth + Ingest + Render
Harmony, Full Build Chaos Battery, Build & Bundle Check, Supabase
Preview, and Workers Builds: sbbl-hq-worker — all green.

Full capability matrix + root-cause fix log in
[`ops/validation/STREAM_PLAYER_UNIVERSAL_E2E_2026-04-19.md`](ops/validation/STREAM_PLAYER_UNIVERSAL_E2E_2026-04-19.md).

## 2026-04-17 — v1.2.0 — Broadcast overlay, engagement, sponsors, AI digest, OBS control

Closes every gap called out in the investor-readiness research memo:

- **Scoreboard overlay** — new chromeless `/overlay/:gameId` route
  serves OBS as a 1920×1080 transparent browser source. Renders score,
  clock (ticks at 10 Hz between 1 s polls), period, fouls, timeouts,
  possession indicator, bonus flags, lower third, and sponsor bug.
- **Overlay control** — admin-only `/overlay-control/:gameId` console
  drives every scoreboard field: +1/+2/+3 scoring, -1 correction,
  start/stop/set clock, period advance, fouls, timeouts, possession,
  lower-third announce/hide, one-click reset, OBS command buttons.
- **Interactive engagement** — `/engage` page with three tabs: Polls &
  Trivia, Watch Parties, Leaderboard. Anonymous fans see results;
  signed-in fans cast votes (one per poll), earn gamification points
  when graded, and host/join watch parties via 6-char invite codes.
- **Sponsor overlay system** — `sponsor_slots` table + admin CRUD +
  public rotation (15 s deterministic slot) + impression/click
  tracking via `sponsor_impressions`.
- **AI weekly digest** — new `/digest` page backed by
  `ai_weekly_digest` cache keyed on `(league_id, week_start)`. Worker
  collects real facts from `games` + `player_game_stats`, calls Groq
  `llama-3.3-70b-versatile` when `GROQ_API_KEY` is set, falls back to
  a deterministic template otherwise. Per-league tabs (SBBL / WBL /
  TGIFBL).
- **OBS remote control** — queue-based bridge: web ops enqueues
  commands, on-site `obs-agent` pulls + acks via Bearer
  `OBS_AGENT_TOKEN`. Supports stream/record start/stop, scene switch,
  source visibility, filter toggle, text update, browser refresh.
- **Gamification leaderboard RPC** — `get_gamification_leaderboard`
  aggregates points per user with display name join.
- **Auto-overlay trigger** — `trg_ensure_overlay_state` creates an
  overlay row on every new `games` insert so the OBS source never
  404s on a fresh game.
- **Route registration tests** — 15 new assertions in
  `worker-overlay-engagement-routes.test.ts` guard the route table.

All new tables RLS-enabled with policies scoped to the live `app_role`
enum (`super_admin`, `league_admin`, `team_manager`, `media_operator`).

Migration `supabase/migrations/20260417100000_overlay_engagement_sponsor_digest.sql`
applied to project `ezanilxygnpucwkwpsoc` on 2026-04-17 — 10 tables
created, 17 existing games backfilled with overlay state rows, 1 RPC
and 1 trigger installed. Full validation evidence in
[`docs/features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md`](docs/features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md).

Gates on 2026-04-17: typecheck clean · lint 0/0 · vitest 745 passed ·
production build OK (4 new chunks).

## 2026-04-16 — v1.1.0 — Documentation Audit & Consolidation

- Audited every document in the repository root and under `docs/`.
- Removed superseded specs: `docs/features/STREAM_GATING_v1.4.0.md` (replaced by v1.5.0) and `docs/quality/LIVESTREAM_WORKFLOW_AUDIT_2026-04-04.md` (replaced by the 2026-04-09 integrity audit).
- Renamed unversioned architecture docs under `docs/architecture/` with standard `_vX.Y.Z.md` suffix:
  - `CANONICAL_DATA_PIPELINE` → `architecture/CANONICAL_DATA_PIPELINE_v1.0.0.md`
  - `COMPLETE_CODEBASE_MAP.md` → `architecture/COMPLETE_CODEBASE_MAP_v1.0.0.md`
  - `api_contracts.md` → `architecture/STORE_API_CONTRACTS_v1.0.0.md`
  - `store_architecture.md` → `architecture/STORE_ARCHITECTURE_v1.0.0.md`
- Renamed quality docs to include version suffix and added standard front-matter:
  - `LIVESTREAM_INGEST_BROADCAST_SYSTEM_INTEGRITY_AUDIT_2026-04-09.md` → `_v1.0.0.md`
  - `MEDIA_PUBLICATIONS_SORT_ORDER_MIGRATION_2026-04-16.md` → `_v1.0.0.md`
  - `PRODUCTION_ENV_VERIFICATION_2026-04-15.md` → `_v1.0.0.md`
- Added `<!-- Version | Date | Status -->` front-matter to all docs previously missing it.
- Rewrote `README.md` doc links — every target now points at an existing file at its current version.
- Rewrote `docs/README.md` master index — reflects actual on-disk file set, adds Agents section, links root-level policy docs (ONE_DEVICE, PAYWALL, RESUME, STREAM_TEST_STRATEGY).

## 2026-04-16 — v1.0-store-canonicalization-hardening

- Standardized the database schema on `store_products`, `store_orders`, and `custom_quote_requests`.
- Implemented robust server-side webhook syncing for store orders.
- Removed mock data paths from UI and properly fetched via Edge Workers.
- Enforced strict IDEMPOTENCY KEY propagation.
- Canonicalized internal API data maps.
