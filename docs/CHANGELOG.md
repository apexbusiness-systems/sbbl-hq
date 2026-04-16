# Changelog

## [v1.4-recsys-cv-endpoints] - 2026-04-16
### Added
- Added `handleRecsysFeed` endpoint on `/api/feed/recsys` for stage 1 candidate generation + stage 2 engagement ranking of `potg` clips with edge caching.
- Added `handleCVEventIngest` endpoint on `/api/games/:id/cv-events` to receive computer-vision tagged events securely.
- Implemented `handlePrivacyRevocation` endpoint on `/api/privacy/revoke` allowing players to instantly revoke all consent receipts.

## [v1.3-sim-coach-mode] - 2026-04-16
### Added
- Created `SimCoachClient` WebGL placeholder component.
- Implemented `SpeechRecognition` API hooks to convert voice commands (e.g. "pick and roll", "isolation") into structured `game_events` payload inserts.
- Fixed strict TypeScript issues regarding browser globals and exhaustive hooks in React.

## [v1.2-hoopstok-mvp] - 2026-04-16
### Added
- Added `HoopsTokFeed` vertical swipe feed component mimicking TikTok with absolute positioning, snap points, and mock engagement controls.
- Mapped `/tok` route in `App.tsx` pointing to `HoopsTokPage`.
- Safely handled `Record<string, unknown>` payload arrays via safe `String()` coercion.

## [v1.1-broadcast-mvp] - 2026-04-16
### Added
- Created `BroadcastOverlayPage` mapped to `/broadcast/:gameId` for OBS Browser Sources.
- Added `BroadcastOverlay` UI component syncing realtime `game_events` with Supabase.
- Built `PipStatsDrawer` for the viewer app (PiP and robust holding to clip UI functionality).
- Added `OperatorTaggingUI` component for real-time manual tagging (score, fouls, moments).
- Maintained exact color branding (#0A0A0A bg, #C9A84C gold).

## [v1.0-consolidated-event-stream] - 2026-04-16
### Added
- Created foundational Supabase migration `20260416000000_consolidated_event_stream.sql` to track game events via a core truth ledger `game_events`.
- Implemented robust PIPA/PIPEDA consent schema via `player_consent_receipts`.
- Exposed Zod schemas and TypeScript typings in `src/types/game-event.ts`.
- Added idempotent POST route in Cloudflare Worker `/api/games/:id/events` for ingestion.

### Changed
- Patched existing integration test `worker-ingest-pipeline.test.ts` to align fetch sort assertions with performance best-practice double ordering.
