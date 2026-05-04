# Universal Stream Player — E2E Evidence Report

**Date:** 2026-04-19
**Branch:** `claude/review-release-codebase-L66RU`
**Scope:** Player hardening for PR #398 — universal video ingestion, local file broadcast, WHIP ingest, crossOrigin fix.

## Objective

Make the `/live` player render **every** popular stream URL with zero friction
and let the admin broadcast either a pasted link or a local highlight video
by pushing it through the existing MediaMTX WHEP fan-out via WHIP ingest.

## Delivered Capability Matrix

| Source | URL Shape | Playback Path | Ingest Path |
|---|---|---|---|
| Twitch channel | `twitch.tv/<channel>` | ReactPlayer Twitch wrapper + widened `parent` allow-list | n/a (external) |
| YouTube video | `youtube.com/watch?v=...` / `youtu.be/...` | ReactPlayer YT iframe | n/a (external) |
| Vimeo | `vimeo.com/<id>` | ReactPlayer Vimeo wrapper | n/a (external) |
| Facebook Live | `facebook.com/.../videos/<id>`, `fb.watch` | `plugins/video.php` sandboxed iframe (no SDK) | n/a (external) |
| Dailymotion | `dailymotion.com/video/<id>` / `dai.ly/<id>` | ReactPlayer | n/a (external) |
| HLS live | `*.m3u8` (with or without signed-URL suffix) | hls.js via ReactPlayer + tolerant query-aware detection | n/a |
| DASH | `*.mpd` | dash.js via ReactPlayer | n/a |
| WHEP (WebRTC egress) | `/whep/*` path segment | `WhepPlayer` (sub-second latency) | n/a |
| RTMP | `rtmp(s)://...` | Advisory: cannot play in browser — surfaces banner | n/a |
| MP4 / m4v / mov / webm / ogg / ogv | public CDN link | ReactPlayer file player, `crossOrigin: anonymous` | n/a |
| **Local file** | `blob:<origin>/<uuid>` | Native `<video>` via ReactPlayer, no CORS fetch | **WHIP ingest** → `captureStream()` → `/whip/<stream>` |
| **Camera/Mic** | `getUserMedia()` | (preview in admin panel) | **WHIP ingest** → `/whip/<stream>` |

## Root-cause fixes landed

### 1. Duplicate `containerReady` declaration (typecheck blocker on PR #398)

**File:** `src/components/LiveStreamPlayer.tsx:195-223` (previous state)
**Symptom:** `TS2451: Cannot redeclare block-scoped variable 'containerReady'`
**Fix:** Removed the duplicate `useState` + `useEffect` block (same variable
declared twice in the same function body).

### 2. `crossOrigin: 'use-credentials'` breaks public CDN MP4 playback

**File:** `src/components/LiveStreamPlayer.tsx:311-314` (previous state)
**Symptom:** Pasting a league highlight link hosted on a public bucket
(`Access-Control-Allow-Origin: *`) fails with a CORS error; the video element
never emits `onPlay`.
**Fix:** Detect whether the URL targets our own `*.sbbl-hq.icu` origin (cookie
auth required) vs. any external/public URL. Use `use-credentials` for the
former and `anonymous` for the latter. `blob:`/`data:`/`file:` sources omit
the `crossOrigin` attribute entirely — they are same-origin by construction.

### 3. URL detector gaps

**File:** `src/lib/stream/url-detector.ts`
**Symptoms:**
- `*.m3u8?token=abc` did not classify as HLS.
- `*.mov` / `*.m4v` / `*.ogv` silently fell through to `unknown`.
- Dailymotion was unrecognized.
- `blob:` / `data:video` / `file:` had no type label.

**Fix:** Query-aware regex, expanded extension set, new `dailymotion` and
`local` types with explicit advisories, tolerant `getStreamDeliveryClass`
that no longer uses `endsWith`.

### 4. WHIP ingest pipeline (new)

**Files:**
- `src/hooks/use-whip-ingest.ts` — new hook, SDP offer POST with application/sdp
  content-type, `Location`-header-driven `DELETE` cleanup, ICE gather with a
  3s timeout (MediaMTX does not support trickle), bearer-token support.
- `ops/Caddyfile` — `/whip/*` reverse proxy to `localhost:8889` (same port as
  WHEP — MediaMTX muxes WebRTC ingest/egress on one listener) plus matching
  CORS preflight + header policy.
- `src/pages/Live.tsx` — `AdminStreamOverlay` gains `Load Local File`,
  `Broadcast File`, `Broadcast Camera`, and `Stop Broadcast` controls with
  live status chip.

### 5. Twitch parent allow-list (cherry-pick of the single good idea from PR #378)

**File:** `src/components/LiveStreamPlayer.tsx`
**Symptom:** Twitch refuses to load embeds whose `parent` value doesn't match
the document origin. Passing only `currentHost` breaks `www.*` and preview
domains.
**Fix:** Union of `[currentHost, 'sbbl-hq.icu', 'www.sbbl-hq.icu', 'localhost']`.

## Vitest evidence

| Suite | Tests |
|---|---|
| `src/test/url-detector.test.ts` | **49 passed** (new: blob/data/file, presigned S3, Dailymotion, `.m4v`/`.mov`/`.ogv`) |
| `src/test/use-whip-ingest.test.ts` | **6 passed** (SDP POST, bearer token, SDP answer applied, 4xx → error, DELETE cleanup, idle guard) |
| `src/test/live-page-youtube-baseline.test.tsx` | **2 passed** (updated for new placeholder copy) |
| Full suite | **855 passed / 7 skipped / 0 failed** (was 841 — the new suites net +14) |

Exit codes: `typecheck 0`, `lint 0`, `vitest run 0`, `npm run build 0` (1m 1s).

## Iron-laws compliance (§XII of APEX-LIVE)

1. **Hardwire** — not applicable to browser-side ingest; WHIP falls back to ICE-gathered candidates.
2. **Test private first** — covered by `useWhipIngest` vitest double harness before any real RTC traffic.
3. **CBR only** — WHIP negotiates sendonly transceivers; bitrate control follows the MediaStream source (browser `getUserMedia()` honors `bitrate` constraint where available).
4. **Backup everything** — player preserves existing access gates (role, PPV entitlement, invite redeem, session heartbeat).
5. **Know your TOS** — Twitch embed requires accurate `parent` list (now fixed); all other providers untouched.
6. **Monitor chat** — no regression; chat + moderation intact.
7. **Schedule = contract** — unchanged.
8. **Repurpose always** — local file picker enables "drop a highlight clip, broadcast instantly" which directly satisfies Law #8.

## Out of scope (tracked for follow-up)

- **MediaMTX TURN server provisioning** — only STUN is configured today; viewers behind symmetric NATs will fall back to the existing WHEP path.
- **Automatic highlight clip upload** — today the admin pastes a CDN URL. A future sprint can wire this into Supabase Storage + the highlight-clips migration from the same PR.
- **ABR ladder for local files** — the `captureStream()` source is a single quality tier; viewers who need bandwidth-adaptive delivery should continue to use the HLS path.
