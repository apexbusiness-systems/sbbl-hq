-- Shared, DB-backed stream interaction rate limiting for multi-instance workers.
create table if not exists public.stream_rate_limits (
  scope text not null,
  key text not null,
  count integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key)
);

create index if not exists idx_stream_rate_limits_updated_at
  on public.stream_rate_limits(updated_at);

create or replace function public.consume_stream_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(1, p_window_seconds));
  v_count integer;
begin
  insert into public.stream_rate_limits as rl (scope, key, count, window_started_at, updated_at)
  values (p_scope, p_key, 1, v_now, v_now)
  on conflict (scope, key) do update set
    count = case
      when rl.window_started_at <= v_now - v_window then 1
      else rl.count + 1
    end,
    window_started_at = case
      when rl.window_started_at <= v_now - v_window then v_now
      else rl.window_started_at
    end,
    updated_at = v_now
  returning count into v_count;

  return v_count <= greatest(1, p_limit);
end;
$$;

revoke all on function public.consume_stream_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_stream_rate_limit(text, text, integer, integer) to authenticated;
grant execute on function public.consume_stream_rate_limit(text, text, integer, integer) to service_role;
