-- Batch heartbeat UPDATE function: accepts an array of session heartbeat
-- payloads and performs a single bulk UPDATE via unnest, cutting per-viewer
-- writes from 800/s down to ~1 bulk call every 30s at 20K concurrency.
create or replace function public.batch_heartbeat_upsert(
  p_heartbeats jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update stream_access_sessions sas
  set
    -- Clamp expires_at to the hard 6-hour ceiling; heartbeats may never extend
    -- a session past max_expires_at.  If max_expires_at is NULL (old rows),
    -- fall back to the requested expires_at unclamped.
    expires_at   = least(h.expires_at, coalesce(sas.max_expires_at, h.expires_at)),
    status       = case
                     when sas.max_expires_at is not null and h.now_ts >= sas.max_expires_at
                     then 'ended'   -- 6-hour window exhausted
                     else 'active'
                   end,
    last_seen_at = h.now_ts,
    updated_at   = h.now_ts,
    updated_by   = h.user_id
  from (
    select
      (elem ->> 'session_id')::uuid  as session_id,
      (elem ->> 'user_id')::uuid     as user_id,
      (elem ->> 'game_id')::uuid     as game_id,
      (elem ->> 'expires_at')::timestamptz as expires_at,
      (elem ->> 'now_ts')::timestamptz     as now_ts
    from jsonb_array_elements(p_heartbeats) as elem
  ) h
  where sas.id      = h.session_id
    and sas.user_id  = h.user_id
    and sas.game_id  = h.game_id
    and sas.status  != 'displaced';  -- do not revive displaced sessions
end;
$$;

-- Ensure only the service role can call this function
revoke execute on function public.batch_heartbeat_upsert(jsonb) from public;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from anon;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from authenticated;
