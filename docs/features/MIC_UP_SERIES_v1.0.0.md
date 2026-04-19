# MIC_UP_SERIES v1.0.0

## Scope
- Intro sting mounted on `/live` for active Mic Up sessions.
- Lower-third + trash-talk overlays subscribe to `overlay:{gameId}` realtime channel.
- Admin trigger UI hosted at `/ops/biometrics`.

## Flags
- Worker: `FEATURE_MIC_UP_SERIES=true`
- Client: `VITE_FEATURE_MIC_UP_SERIES=true`

## API
- Trigger: `POST /api/streams/:gameId/overlay/event`
- Read latest: `GET /api/streams/:gameId/overlay/events/latest`

## Rollback
- Disable both flags.
- Keep route enabled until queued ops actions complete.
