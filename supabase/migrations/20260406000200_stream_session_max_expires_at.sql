-- Add max_expires_at to stream_access_sessions to enforce the 6-hour hard cap.
-- Once a playback session starts, heartbeats may not extend it past this ceiling.
-- This enforces the "one device, 6hr max" contract for both PPV and player access.
alter table public.stream_access_sessions
  add column if not exists max_expires_at timestamptz;

-- Back-fill existing sessions: cap = created_at + 6h (reasonable default)
update public.stream_access_sessions
set max_expires_at = created_at + interval '6 hours'
where max_expires_at is null;

-- Create a composite index used by the heartbeat cap check
create index if not exists idx_stream_session_max_expires
  on public.stream_access_sessions (user_id, game_id, max_expires_at)
  where status = 'active';
