# Broadcast Overlay Audit — Reconciliation

**Date:** 2026-04-17
**Scope:** Cross-reference the "SBBL-HQ Codebase Audit: Live Stream Overlay
Research vs. Implementation" (2026-04-16) against the actual state of `main`
at commit `32a31d0`.
**Method:** Verified every claim by touching real code — grep, file reads,
migration inspection, route registry, git log. No assumptions.

## TL;DR

The 2026-04-16 audit is **stale**. It was written before commits
`9dfc548 feat(broadcast): ship overlay, engagement, sponsors, AI digest,
OBS control` and `7adc229 docs: document overlay, engagement, sponsors,
digest, OBS routes + tables` landed, along with migration
`supabase/migrations/20260417100000_overlay_engagement_sponsor_digest.sql`.
Between them, those commits close the large majority of the audit's
"NOT IMPLEMENTED" rows.

A small set of residual gaps remains — most importantly, `games`,
`overlay_game_state`, and `stream_chat_messages` are **still not published
to `supabase_realtime`**, so the overlay and chat still poll.

## Audit claims NO LONGER accurate (already shipped)

| Audit claim | Status | Evidence |
|---|---|---|
| No `/overlay/*` route | Shipped | `src/pages/Overlay.tsx`, `src/App.tsx:124` |
| No scoreboard/scorebug component | Shipped | `Overlay.tsx:159-251` — scorebug, clock, lower third, sponsor bug |
| No OBS browser source | Shipped | Transparent chromeless shell; body bg reset; 1 s poll (`Overlay.tsx:52-86`) |
| No admin operator console | Shipped | `src/pages/OverlayControl.tsx` at `/overlay-control/:gameId` |
| No OBS WebSocket control | Shipped | `obs_commands` queue (migration §7), `src/worker/routes/obs.ts`, `enqueueObsCommand` at `src/lib/api/digest.ts:39-48` |
| Sponsor overlay / rotation | Shipped | `sponsor_slots` + `sponsor_impressions`, 15 s deterministic rotation (`src/worker/routes/overlay.ts:144-158`), `src/lib/api/sponsors.ts` |
| Interactive polls | Shipped | `engagement_polls` + `engagement_poll_votes`, `/engage` page, `src/lib/api/engagement.ts` |
| Predictions / trivia | Shipped | Same `engagement_polls` table with `kind in ('poll','prediction','trivia')` (migration line 152) |
| Gamification points + leaderboard | Shipped | `gamification_points` + `get_gamification_leaderboard` RPC (migration §4, §8) |
| Watch parties | Shipped | `watch_parties`, `watch_party_members`, join-by-code (`engagement.ts:110-115`) |
| AI weekly digest | Shipped | `ai_weekly_digest` table, `/digest` page, `src/worker/routes/digest.ts`, fallback-template path when `GROQ_API_KEY` absent |
| Lower third (manual) | Shipped | `show_lower_third` + editor at `OverlayControl.tsx:321-380` |

## Audit claims STILL accurate (residual gaps)

| Gap | Reality | Evidence |
|---|---|---|
| `games` not Realtime-published | Still true | Only `stream_reactions` has a `supabase_realtime ADD TABLE` — see `supabase/migrations/20260404002000_stream_reactions.sql:30`. No equivalent for `games`, `overlay_game_state`, or `stream_chat_messages`. |
| Chat polled every 5 s | Still true | `src/pages/Live.tsx:698` — `setInterval(fetchComments, 5000)` |
| Overlay polls every 1 s | Still true | `src/pages/Overlay.tsx:81` — `setInterval(load, 1000)`. Should become a `postgres_changes` subscription once `overlay_game_state` is published. |
| Scorekeeper mobile UI | Still missing | No file matches `scorekeeper` / `stat-keeper` in `src/**`. Current entry remains admin batch (manual, CSV, OCR) in `Ops.tsx`. |
| Auto-highlight / pose estimation | Still missing | Zero matches for `MediaPipe`, `pose estimation`, `auto.?highlight`. |
| Cheer meter visualization | Still missing | Reactions exist + realtime-powered, but no aggregated meter UI. |
| Lower third auto-fire on stat INSERT | Still missing | Only manual trigger via `OverlayControl`. |

## Recommended next passes

1. **One-line migration** — publish the three tables required for push-based UX:
   ```sql
   ALTER PUBLICATION supabase_realtime
     ADD TABLE overlay_game_state, games, stream_chat_messages;
   ```
2. **Replace `/overlay/:gameId` poll** with a `postgres_changes` subscription
   (pattern already proven in `src/pages/Live.tsx:603-607` for reactions).
   This drops overlay lag from ~1 s to ~100 ms and removes ~86k req/day/game
   at scale.
3. **Replace chat 5 s poll** in `Live.tsx:698` with the same subscription
   pattern — instant messages, lower worker load.
4. **Scorekeeper mobile UI** — add a `/scorekeeper/:gameId` route that
   drives the same `/api/ops/overlay/:gameId/*` endpoints the OverlayControl
   already uses, but optimised for phone-in-hand stat entry.
5. **Cheer-meter aggregate** — 15 s rolling sum of `stream_reactions` by
   `kind`, rendered as a horizontal bar in the overlay. Reuses existing
   table; no schema change required.
6. **Lower-third auto-fire** — Supabase trigger on `player_game_stats`
   INSERT that writes to `overlay_game_state.lower_third_*` when
   `pts >= 25` (or similar threshold). Still respects
   `show_lower_third` so the operator can silence it.

## Audit surface that was never contentious

The following areas were marked `✅ IMPLEMENTED` in the original audit and
still verify:

- `src/lib/stream/streamforge.ts` — QoE engine, 700+ lines
- `src/lib/stream/qoe-beacon.ts` — sendBeacon shipper
- `src/components/LiveStreamPlayer.tsx` — 13-source player
- `src/components/WhepPlayer.tsx` — WHEP WebRTC
- `src/test/stream-20k-stress.test.ts` — 20K stress suite
- `stream_admin_config` + `stream_access_sessions` + `stream_entitlements`
- `media_publications` + Groq vision parsing
- `mvw_standings` + `get_leaderboards` RPC

None of those require action.

## Files touched during verification

None. This pass was read-only; the deliverable is this reconciliation
document.
