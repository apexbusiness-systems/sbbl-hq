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
    expires_at   = h.expires_at,
    status       = 'active',
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
    and sas.game_id  = h.game_id;
end;
$$;

-- Ensure only the service role can call this function
revoke execute on function public.batch_heartbeat_upsert(jsonb) from public;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from anon;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from authenticated;
