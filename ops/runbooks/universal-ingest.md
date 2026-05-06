# OPS RUNBOOK: Universal Stream Ingest

> **Baseline reference build: v1.4.0 (2026-04-29).** See `CHANGELOG.md` and
> `CLAUDE.md` §1.5 *Live Player Invariants*. The pipeline simulation
> (`npm run simulate:broadcast`) is the canonical end-to-end validator —
> run it before and after any change that touches `url-detector.ts`,
> `LiveStreamPlayer.tsx`, or the worker's stream-resolution path.

## 1. Overview
The Universal Stream Ingest ensures that operators can proceed with streaming links regardless of confidence, URL format, or platform constraints (such as Facebook or unrecognized schemes). The backend gracefully handles untrusted protocols and unrecognized links to avoid preventing stream publishing.

## 2. Ingest Architecture
- **No Pre-Live Blockers:** The Cloudflare worker (`validate-stream-url.ts`) and ingest logic (`handleUpdateStreamConfig` & `handleGoLive`) have had restrictive gates removed.
- **Permissive Flow:** All provided URL strings are automatically parsed. If the URL uses unparseable schemas, it skips `new URL()` validation and passes verbatim. Unsafe schemas (`javascript:`, `vbscript:`, etc) are replaced securely while the operator encounters **zero frontend rejection blocks**.

## 3. UI and Monitoring
1. In the Broadcast Controls (`Live.tsx`), the operator enters a URL.
2. No validation popups will appear except advisory text regarding the protocol parsed via `url-detector.ts`.
3. Operator can securely start streaming without `Stream URL is invalid` or similar error flags rejecting the save action.

## 4. Fallback Handling
If a link causes an unplayable stream (RTMP, Kick, Instagram Live, X Spaces):
1. `StreamPlayer` short-circuits **before** ReactPlayer mounts and renders a typed advisory panel ("RTMP Stream Detected", etc.) with a concrete next step (configure HLS / YouTube / Twitch / Vimeo). Facebook URLs are handled separately via sandboxed iframe embed (see §5).
2. Operators see real-time player errors on the admin stream preview.
3. The operator can patch a new URL and `Save` without resetting the livestream layout.

## 5. Provider Compatibility Matrix (v1.4.0 baseline)

This matrix is generated and asserted by `npm run simulate:broadcast`. It MUST stay green.

| Provider | Detect | Canon | Viewer outcome |
|---|---|---|---|
| HLS (`.m3u8`, signed CDN) | `hls` | accept | ReactPlayer (proxy) |
| DASH (`.mpd`) | `dash` | accept | ReactPlayer (proxy) |
| MP4 / m4v / mov / webm / ogg / ogv | `mp4` | accept | ReactPlayer (proxy) |
| YouTube (live, `/embed/`, `/watch`) | `youtube` | accept | ReactPlayer (embed, auto-normalized) |
| Twitch (channel, `player.twitch.tv` legacy) | `twitch` | accept | ReactPlayer (embed, auto-normalized) |
| Vimeo | `vimeo` | accept | ReactPlayer (embed → `player.vimeo.com`) |
| WHEP (low-latency WebRTC) | `whep` | accept | WhepPlayer |
| RTMP | `rtmp` | accept | **advisory:rtmp** |
| Facebook (page, `fb.watch`, videos) | `facebook` | accept | **iframe:plugins/video.php** |
| Kick | `kick` | accept | **advisory:unembeddable** |
| Instagram Live | `instagram` | accept | **advisory:unembeddable** |
| X Spaces | `x-spaces` | accept | **advisory:unembeddable** |
| Empty / garbage | `unknown` | **reject** | n/a |

## 6. Pre-flight validation checklist (run before going live)

```bash
npm run typecheck         # clean — no type errors
npm run lint              # clean — max-warnings 0
npm test                  # all green; live-stream-player-regressions.test.ts MUST pass
npm run simulate:broadcast  # 19 / 19 scenarios MUST pass
```

If any check fails, **do not deploy**. Fix the regression — never disable
the failing test or scenario. Each existing assertion maps to a real
production incident; see `CHANGELOG.md` v1.4.0 entry for the incident
register.

## 7. Adding a new provider

When adding support for a new stream source:

1. Extend `StreamUrlType` and the detector chain in `src/lib/stream/url-detector.ts`.
2. If the provider has no embed surface compatible with our CSP, add it
   to the `isUnembeddable` branch in `StreamPlayer` (per `CLAUDE.md` §1.5.3).
3. Add a scenario to `scripts/simulate-broadcast.ts` with the expected
   `type / canonicalize / viewer` triple.
4. Run `npm run simulate:broadcast` and confirm the new scenario passes.
5. Update the matrix in §5 of this runbook.
