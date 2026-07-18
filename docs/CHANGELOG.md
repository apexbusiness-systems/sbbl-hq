# CHANGELOG

## 2026-07-18 — v1.7.0 — Chrome CORS whitelisting, local config guardrails, Cloud Supabase, secure CSV upload

- **CORS Local Whitelisting** (`src/worker/index.ts` and `src/api-proxy-worker/index.ts`): Whitelisted `http://localhost:8080` to prevent OPTIONS preflight failures in Google Chrome.
- **Wrangler Config Guardrail**: Reverted `SUPABASE_PUBLISHABLE_KEY` in `wrangler.jsonc` to the placeholder to pass security tests; added `.dev.vars` for local credential binding.
- **Supabase Cloud Migration** (PR #552): Migrated configurations to Supabase Cloud, executed missing migrations, and secured the `v_ingest_reconciliation` view.
- **Secure CSV Ingestion** (PR #553): Modularized parser route handler, established typed `ParseResult` contract, integrated RxDB local queuing in hooks, and resolved all 8 ESLint `no-explicit-any` strict type violations.
- **Dependency & Build Upgrades**: Upgraded Playwright to v1.60.0 and synchronized lockfile from PR-543.

---

## 2026-05-21 — v1.6.0 — Self-hosted Supabase hardening & Kong CORS fixes

- **Self-hosted Supabase stack**: Nested Compose root in `sbbl-hq-selfhost/sbbl-hq-selfhost/` with directory-level warnings.
- **Secret rotation runbook**: Safe secret rotation guidelines without downtime.
- **Auth security audit**: Cleaned dependencies, patched Kong routes against injection, and added unit/integration tests for auth flows.
- **Kong CORS Preflight**: Patched 6 auth routes in nested active `kong.yml` to whitelist all 20 required PostgREST/Supabase headers.
- **Media console overhaul**: Optimized publications queries, close archive race window.

---

## 2026-05-11 — v1.5.0 — OmniBridge Integration (APEX-OmniHub bidirectional sync)

- **POST /webhooks/omnihub**: Inbound receiver with HMAC-SHA256 signature verification, skew-check, action allowlist, risk-lane re-classification, and idempotency dedup.
- **POST /api/omniport/command**: JWT-authenticated operator session endpoint.
- **deliverSyncEnvelope()**: Outbound sync with exponential backoff and timeout logic.

---

## 2026-05-04 — v1.4.1 — Facebook Live playback via plugins/video.php iframe

- Facebook stream URLs are now playable. The `isFacebook` branch in
  `LiveStreamPlayer.tsx` renders a `plugins/video.php` sandboxed iframe
  instead of the "not supported" advisory panel.
- CSP: `frame-src` gains `https://www.facebook.com`; `script-src` unchanged
  (FB SDK still blocked).
- `live-stream-player-regressions.test.ts` and `worker-ops-health.test.ts`
  updated to assert the iframe implementation.

---

## 2026-04-19 — v1.3.0 — Universal Stream Player, WHIP Ingest, Zero-Friction Broadcast

- **Universal URL detection**: `src/lib/stream/url-detector.ts` recognizes
  Twitch, YouTube, Vimeo, Facebook, Kick, Rumble, Dailymotion, X Spaces,
  Instagram Live, HLS (presigned), DASH, WHEP, RTMP, direct
  MP4/m4v/mov/webm/ogg/ogv (including presigned S3/R2 signed URLs), and the
  new `local` class for `blob:` / `data:video` / `file:` sources.
- **Origin-aware CORS on the player**: credentialed requests only to
  `*.sbbl-hq.icu`; anonymous CORS to every public CDN; omitted entirely for
  `blob:`/`data:`/`file:`. Fixes league-highlight MP4 playback behind public
  buckets that return `Access-Control-Allow-Origin: *`.
- **Twitch parent allow-list** now unions `[currentHost, sbbl-hq.icu,
  www.sbbl-hq.icu, localhost]` so preview/www variants stop being rejected.
- **Browser-native WHIP ingest** via new `useWhipIngest` hook
  (`src/hooks/use-whip-ingest.ts`): sendonly transceivers, SDP handshake,
  Location-header cleanup, optional bearer token, deterministic 3 s ICE
  gather ceiling (MediaMTX does not trickle).
- **AdminStreamOverlay broadcast cockpit** on `/live`: Load Local File,
  Broadcast File (via `HTMLVideoElement.captureStream()`), Broadcast
  Camera (via `navigator.mediaDevices.getUserMedia`), and Stop Broadcast,
  each with a live WHIP status chip. Blob URLs revoke on reselect + unmount.
- **Caddyfile `/whip/*` proxy** on `stream.sbbl-hq.icu` → MediaMTX 8889
  (same listener as WHEP; WebRTC mux). Full CORS policy + preflight.
- **TS2451 blocker fix**: duplicate `containerReady` declaration removed
  in `LiveStreamPlayer.tsx`; duplicate tap-to-unmute overlay collapsed.
- **Playwright harness**: `expect.timeout` raised to 15 s to eliminate Vite
  dev cold-compile flake on `/live` first paint.
- **Eslint `.claude` ignore** so subagent worktree artifacts never pollute
  lint reports.
- Full capability matrix + root-cause log:
  [`ops/validation/STREAM_PLAYER_UNIVERSAL_E2E_2026-04-19.md`](../ops/validation/STREAM_PLAYER_UNIVERSAL_E2E_2026-04-19.md).
- New docs: `docs/features/STREAM_GATING_v1.7.0.md`,
  `docs/operations/OPERATIONS_RUNBOOK_v1.6.0.md`.

Gates on 2026-04-19: typecheck clean · lint 0/0 · vitest 857 passed / 7
skipped / 0 failed · production build 61 s · PR #398 CI all-green.

## 2026-04-17 — v1.2.0 — Broadcast overlay, engagement, sponsors, AI digest, OBS control

- **Overlay (OBS browser source)**: new chromeless `/overlay/:gameId` page.
  `overlay_game_state` table holds period, clock, score, fouls, timeouts,
  possession, bonus, lower-third, sponsor-bug flag. Auto-created by trigger
  on every new game. Admin mutations via `/api/ops/overlay/:gameId/{state,clock,score,foul,period,reset}`.
- **Overlay control console**: `/overlay-control/:gameId` admin page drives
  every scoreboard field in real time, plus the OBS command queue.
- **Interactive engagement**: polls/predictions/trivia (`engagement_polls` +
  `engagement_poll_votes` with one-vote-per-user uniqueness), gamification
  (`gamification_points` + `get_gamification_leaderboard` RPC), watch parties
  with 6-char invite codes (`watch_parties`, `watch_party_members`). New
  `/engage` page.
- **Sponsor overlay**: `sponsor_slots` with weight, league scope, start/end
  windows. In-overlay rotation every 15 s (deterministic across viewers).
  Impression + click tracking via `sponsor_impressions`.
- **AI weekly digest**: `/digest` page + `ai_weekly_digest` cache keyed on
  `(league_id, week_start)`. Groq `llama-3.3-70b-versatile` when
  `GROQ_API_KEY` is set; deterministic fallback otherwise. Facts pulled from
  `games` + `player_game_stats` over the last 7 days.
- **OBS remote control**: `obs_commands` queue. Web ops enqueues commands;
  on-site `obs-agent` pulls `/pending` and acks, auth'd by
  `OBS_AGENT_TOKEN` Bearer token. Supports stream/record start-stop, scene
  switch, source visibility, filter toggle, text source update, browser
  refresh.
- Full details + validation evidence in
  [`features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md`](features/BROADCAST_OVERLAY_ENGAGEMENT_v1.0.0.md).

## 2026-04-16 - v1.0-store-canonicalization-hardening
- **Hardening**: Created migration to target `store_orders` in webhook and added audit triggers.
- **Worker API**: Refactored public products to fetch from `store_products`.
- **Worker API**: Added `/api/store/quote` for inserting into `custom_quote_requests` with idempotency.
- **Worker API**: Refactored `/api/store/checkout` to use `store_products` and create pending `store_orders`.
- **Worker API**: Updated Stripe webhook to no longer rely on legacy `orders` and `carts` tables for closing carts.
- **UI**: Connected `Store.tsx` to live product APIs and custom quote submission.
- **UI**: Refactored `BagDrawer.tsx` to pull from API data and submit accurate line item `price_cents`.
- **E2E**: Added tests for store browsing, bag additions, and idempotent custom quote request.
