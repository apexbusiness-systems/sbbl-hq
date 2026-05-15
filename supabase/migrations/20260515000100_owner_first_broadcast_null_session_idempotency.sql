-- Owner-first broadcast auth/live hotfixes.
-- 1) Preserve NULL game_id heartbeats by using null-safe equality.
-- 2) Make regular broadcast session upserts idempotent when game_id is NULL.

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
    expires_at   = least(h.expires_at, coalesce(sas.max_expires_at, h.expires_at)),
    status       = case
                     when sas.max_expires_at is not null and h.now_ts >= sas.max_expires_at
                     then 'ended'
                     else 'active'
                   end,
    last_seen_at = h.now_ts,
    updated_at   = h.now_ts,
    updated_by   = h.user_id
  from (
    select
      (elem ->> 'session_id')::uuid        as session_id,
      (elem ->> 'user_id')::uuid           as user_id,
      nullif(elem ->> 'game_id', '')::uuid as game_id,
      (elem ->> 'expires_at')::timestamptz as expires_at,
      (elem ->> 'now_ts')::timestamptz     as now_ts
    from jsonb_array_elements(p_heartbeats) as elem
  ) h
  where sas.id      = h.session_id
    and sas.user_id  = h.user_id
    and sas.game_id IS NOT DISTINCT FROM h.game_id
    and sas.status  != 'displaced';
end;
$$;

revoke execute on function public.batch_heartbeat_upsert(jsonb) from public;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from anon;
revoke execute on function public.batch_heartbeat_upsert(jsonb) from authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_stream_session_user_game_key'
      AND conrelid = 'public.stream_access_sessions'::regclass
  ) THEN
    ALTER TABLE public.stream_access_sessions
      DROP CONSTRAINT uq_stream_session_user_game_key;
  END IF;

  ALTER TABLE public.stream_access_sessions
    ADD CONSTRAINT uq_stream_session_user_game_key
    UNIQUE NULLS NOT DISTINCT (user_id, game_id, idempotency_key);
END $$;
