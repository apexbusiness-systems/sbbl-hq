# SBBL-HQ Overlay Registry

## Purpose

This registry organizes every audited overlay surface that renders on top of the live game, into OBS, or into operator broadcast tooling. It separates overlays from general live features so scorebug, lower-third, sponsor, biometrics, cheer, Mic Up, and OBS-control behavior can be owned and QA'd independently.

## Overlay Entry Points

| Overlay Surface | Route / Module | Audience | Responsibility |
| --- | --- | --- | --- |
| OBS browser overlay | `/overlay/:gameId`, `src/pages/Overlay.tsx` | OBS / broadcast output | Transparent scorebug, clock, lower-third, cheer meter, sponsor bug, and V2 cards. |
| Overlay control console | `/overlay-control/:gameId`, `src/pages/OverlayControl.tsx` | Admin/operator | Mutates score, clock, fouls, possession, lower-third, sponsor bug, reset, highlights, and OBS commands. |
| Live player overlays | `src/components/LiveStreamPlayer.tsx` | Viewer/admin | Player UI overlays: loading, errors, offline, displaced device, invite, RBAC badge, watermark, controls, tap-to-unmute. |
| Live-page engagement overlays | `src/pages/Live.tsx`, `src/components/*` | Viewer | Biometrics, Mic Up, token award, cheer meter, chat/reactions, CASL nudge. |
| Worker overlay API | `src/worker/routes/overlay.ts` | Frontend/OBS | Public overlay payload and authenticated overlay mutations. |
| OBS command bridge | `src/worker/routes/obs.ts` | Operator + obs-agent | Queue-based OBS control commands for stream/record/source refresh. |

## OBS Browser Overlay (`/overlay/:gameId`)

### Render Contract

- Route is chromeless and must not render the normal app header, drawer, marketing widgets, or toasts.
- Body and document background are forced transparent.
- Pointer events are disabled on the overlay root so OBS/browser-source interaction remains passive.
- Overlay payload is public-read by game UUID because OBS browser sources cannot carry normal app auth.

### Data Inputs

| Input | Source | Cadence |
| --- | --- | --- |
| Game metadata | `/api/public/overlay/:gameId` | Initial load + 5s refresh |
| Overlay state | `/api/public/overlay/:gameId` + Supabase Realtime `overlay_game_state` updates | Initial load + realtime updates |
| Sponsor | `/api/public/overlay/:gameId` | Initial load + 5s refresh / server-side rotation |
| Clock display | Local computation from `clock_seconds`, `clock_running`, and `clock_last_started_at` | 100ms render tick |
| Cheer meter | `CheerMeter` game-specific stream/reaction APIs | Component-owned polling/realtime path |

### Default Scorebug Elements

| Element | Data Fields | Behavior |
| --- | --- | --- |
| League chip | `game.leagues.code` | Falls back to `LIVE` when missing. |
| Away block | away team name, away score, away fouls, away bonus, away timeouts, possession | Shows short code, score, foul/bonus/timeout context, and possession dot. |
| Clock block | `clock_seconds`, `clock_running`, `clock_last_started_at`, `period_label` | Smooth countdown locally; final minute displays tenths. |
| Home block | home team name, home score, home fouls, home bonus, home timeouts, possession | Mirrors away block. |
| Last-event ticker | `last_event_text` | Renders only when event text exists. |
| Lower third | `show_lower_third`, `lower_third_text`, `lower_third_subtext` | Renders only when enabled and text exists. |
| Cheer meter | active `gameId` | Fixed top-left overlay mode. |
| Sponsor bug | `show_sponsor_bug`, sponsor payload | Renders top-right only when enabled and sponsor exists. |

## Overlay V2 Cards

Overlay V2 is feature-flagged and activated by `/overlay/:gameId?card=<card>` when the card is not `scorebug`.

| Card | Purpose | Primary Fields |
| --- | --- | --- |
| `lower-third` | Full lower-third panel | `lower_third_text`, `lower_third_subtext`, `last_event_text`, team names |
| `lineup` | Read-only lineup card | team names and static lineup placeholders |
| `game-state` | Score + clock state card | away score, home score, period label, live clock |
| `sponsor` | Sponsor presentation card | sponsor name, tagline, league code |
| `postgame` | Final score presentation | away score, home score, team names |
| `matchup` | Versus matchup card | away/home names, event name |
| `stat-leader` | Stat/event leader card | `last_event_text`, scoreline |

## Overlay Control Console (`/overlay-control/:gameId`)

### Access Contract

- Route is protected by `RequireAdmin` in the React router.
- Worker mutations independently verify a server-authenticated user role.
- Allowed overlay mutation roles are `super_admin`, `league_admin`, `team_manager`, and `media_operator`.

### Operator Controls

| Control Group | Actions | API Client |
| --- | --- | --- |
| Away score | +1, +2, +3, -1 | `adjustScore(gameId, 'away', ...)` |
| Away foul | +foul | `adjustFoul(gameId, 'away', ...)` |
| Away possession | set possession away | `patchOverlay(gameId, { possession: 'away' })` |
| Clock | start, stop, set 10:00 / 8:00 / 5:00 | `controlClock(gameId, ...)` |
| Period | next period | `advancePeriod(gameId, 'next')` |
| Home score | +1, +2, +3, -1 | `adjustScore(gameId, 'home', ...)` |
| Home foul | +foul | `adjustFoul(gameId, 'home', ...)` |
| Home possession | set possession home | `patchOverlay(gameId, { possession: 'home' })` |
| Lower third | show / hide headline + subtitle | `patchOverlay(...)` |
| Highlights | mark highlight | `HighlightMarker` |
| Sponsor bug | toggle on/off | `patchOverlay(gameId, { show_sponsor_bug })` |
| Reset | reset overlay defaults | `resetOverlay(gameId)` |
| OBS | start/stop stream, start/stop record, refresh overlay | `enqueueObsCommand(...)` |

## Worker Overlay API

### Public Endpoint

| Endpoint | Handler | Behavior |
| --- | --- | --- |
| `GET /api/public/overlay/:gameId` | `handlePublicOverlay` | Validates UUID, loads game metadata, creates overlay row on demand, returns overlay state and active sponsor. |

### Authenticated Mutation Endpoints

| Endpoint | Behavior |
| --- | --- |
| `POST /api/ops/overlay/:gameId/state` | Merge-patches allowed overlay fields. |
| `POST /api/ops/overlay/:gameId/clock` | Starts, stops, or sets game clock. |
| `POST /api/ops/overlay/:gameId/score` | Adjusts or sets home/away score and syncs game score fields. |
| `POST /api/ops/overlay/:gameId/foul` | Adjusts or resets home/away fouls. |
| `POST /api/ops/overlay/:gameId/period` | Advances or sets period label. |
| `POST /api/ops/overlay/:gameId/reset` | Resets overlay state to defaults. |

### State Fields

| Field Group | Fields |
| --- | --- |
| Identity | `game_id`, `overlay_theme` |
| Period / clock | `period`, `period_label`, `clock_seconds`, `live_clock_seconds`, `clock_running`, `clock_last_started_at`, `shot_clock_seconds` |
| Score | `home_score`, `away_score` |
| Fouls / bonus | `home_fouls`, `away_fouls`, `bonus_home`, `bonus_away` |
| Timeouts | `home_timeouts_left`, `away_timeouts_left` |
| Possession | `possession` |
| Event ticker | `last_event_text`, `last_event_at` |
| Sponsor | `show_sponsor_bug` |
| Lower third | `show_lower_third`, `lower_third_text`, `lower_third_subtext` |

## Player Overlays Inside `LiveStreamPlayer`

| Overlay | Trigger | Behavior |
| --- | --- | --- |
| Register gate | no `userId` | Prompts account creation/sign-in before streaming. |
| Entitlement loading | access check pending | Shows spinner while server access check resolves. |
| Preview paywall | registered fan without access | Shows game preview, PPV checkout button, and access-code redemption. |
| Playback loading | session creation/loading | Shows black player loading spinner. |
| Player error | provider/session error | Shows error copy and retry button that increments retry key. |
| Offline | stream marked not live for non-admin | Shows “Stream Starting Soon.” |
| Displaced device | heartbeat session missing/forbidden or repeated failures | Shows one-device enforcement message and resume button. |
| Tap-to-unmute | muted playback has started | Lets viewer unmute after autoplay-safe muted start. |
| Twitch start | Twitch before user gesture | Explicit Start Stream overlay. |
| Invite generator | eligible premium/player/paid/admin users | Generates and copies one fan invite. |
| RBAC badge | playback URL active and no error/loading | Displays Admin/Player/Fan access badge. |
| Watermark | access-granted player | Shows session-bound user prefix. |

## Biometric Video Overlay

| Component | Behavior |
| --- | --- |
| `BiometricDualOverlay` | Bottom gradient overlay for 1v1/2v2 biometric status. Renders only when at least one player snapshot is fresh. |
| `BiometricStatusBar` | Per-player status row. |
| `HeartRateDisplay` | Heart-rate visual. |
| `StaminaBar` | Stamina percentage visual. |
| `FatigueIndicator` | Fresh/moderate/tired/gassed state visual. |

## Mic Up Video Overlays

| Component | Behavior |
| --- | --- |
| `MicUpIntroSting` | Feature-flagged intro sting for Mic Up sessions. |
| `MicUpLowerThird` | Feature-flagged speaker/player lower third. |
| `MicUpSeriesBadge` | Series identity badge. |
| `TrashTalkBanner` | Feature-flagged trash-talk banner on live page. |

## Sponsor Overlay

| Surface | Behavior |
| --- | --- |
| Default scorebug sponsor bug | Top-right sponsor card with optional logo/tagline and sponsor-provided colors. |
| Overlay V2 sponsor card | Large sponsor card when `card=sponsor`. |
| Impression tracking | Tracks one impression per sponsor/game key from the overlay page. |

## Cheer Overlay

| Surface | Behavior |
| --- | --- |
| `/overlay/:gameId` | Fixed top-left `CheerMeter` in overlay mode. |
| `/live` | Inline cheer meter below reactions for real game IDs. |

## OBS Command Registry

| Command Kind | Purpose |
| --- | --- |
| `scene_switch` | Switch OBS scenes. |
| `source_visibility` | Show/hide OBS source. |
| `filter_enable` | Enable/disable OBS filter. |
| `start_stream` | Start OBS stream output. |
| `stop_stream` | Stop OBS stream output. |
| `start_record` | Start recording. |
| `stop_record` | Stop recording. |
| `set_text_source` | Update OBS text source. |
| `refresh_browser_source` | Refresh browser source, used for overlay refresh. |

## QA Checklist

- Verify `/overlay/:gameId` renders with transparent background and no app shell.
- Verify score mutations update both overlay state and public score surfaces.
- Verify clock start/stop/set remains smooth in OBS for at least one period.
- Verify lower-third show/hide updates through Realtime without OBS refresh.
- Verify sponsor bug toggle and sponsor impression tracking.
- Verify V2 card query modes render when feature flag is enabled.
- Verify overlay-control access is denied for non-admin roles.
- Verify OBS command queue requires `OBS_AGENT_TOKEN` for agent polling/ack.
- Verify biometric overlay renders nothing with stale/no snapshots.
- Verify player-displacement overlay appears when the same fan starts another session.
