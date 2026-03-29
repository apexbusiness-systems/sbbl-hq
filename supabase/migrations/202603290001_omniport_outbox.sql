create table if not exists public.ingress_buffer (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  raw_input jsonb not null,
  error_reason text not null,
  status text not null default 'failed',
  risk_score int not null default 100,
  source_type text not null,
  user_id uuid,
  retry_count int not null default 0,
  last_retry_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingress_buffer_priority on public.ingress_buffer(status, risk_score desc, created_at asc);

create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  league_id uuid references public.leagues(id),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  retries int not null default 0,
  trace_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  dead_lettered_at timestamptz
);

create index if not exists idx_event_outbox_claim on public.event_outbox(status, available_at asc, created_at asc);

create or replace function public.record_ingress_failure(
  p_correlation_id uuid,
  p_raw_input jsonb,
  p_error_reason text,
  p_risk_score int,
  p_source_type text,
  p_user_id uuid
) returns jsonb as $$
declare
  v_id uuid;
begin
  insert into public.ingress_buffer(correlation_id, raw_input, error_reason, risk_score, source_type, user_id)
  values (p_correlation_id, coalesce(p_raw_input, '{}'::jsonb), p_error_reason, greatest(p_risk_score, 0), p_source_type, p_user_id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$ language plpgsql security definer;

create or replace function public.get_pending_ingress_buffer(p_limit int default 50)
returns setof public.ingress_buffer as $$
begin
  return query
    select *
    from public.ingress_buffer
    where status in ('failed','retry')
    order by risk_score desc, created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$ language plpgsql security definer;

create or replace function public.claim_ingress_for_replay(p_limit int default 20)
returns setof public.ingress_buffer as $$
begin
  return query
  with candidate as (
    select id
    from public.ingress_buffer
    where status in ('failed','retry')
    order by risk_score desc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.ingress_buffer ib
  set status = 'replaying',
      retry_count = ib.retry_count + 1,
      last_retry_at = now()
  where ib.id in (select id from candidate)
  returning ib.*;
end;
$$ language plpgsql security definer;

create or replace function public.cleanup_ingress_failures(p_older_than interval default interval '30 days')
returns int as $$
declare
  v_deleted int;
begin
  delete from public.ingress_buffer
  where status in ('processed','dead')
    and created_at < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$ language plpgsql security definer;

create or replace function public.enqueue_local_domain_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_league_id uuid,
  p_payload jsonb,
  p_trace_id uuid,
  p_available_at timestamptz default now()
) returns jsonb as $$
declare
  v_id uuid;
begin
  insert into public.event_outbox(event_type, entity_type, entity_id, league_id, payload, trace_id, available_at)
  values (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_league_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_trace_id, gen_random_uuid()),
    coalesce(p_available_at, now())
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$ language plpgsql security definer;

create or replace function public.claim_outbox_events(p_limit int default 20)
returns setof public.event_outbox as $$
begin
  return query
  with candidate as (
    select id
    from public.event_outbox
    where status = 'pending'
      and available_at <= now()
    order by available_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.event_outbox eo
  set status = 'processing'
  where eo.id in (select id from candidate)
  returning eo.*;
end;
$$ language plpgsql security definer;

create or replace function public.mark_outbox_delivered(p_outbox_id uuid)
returns jsonb as $$
begin
  update public.event_outbox
  set status = 'delivered'
  where id = p_outbox_id;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.mark_outbox_retry(p_outbox_id uuid, p_error_message text default null)
returns jsonb as $$
declare
  v_retries int;
begin
  update public.event_outbox
  set retries = retries + 1,
      status = case when retries + 1 >= 8 then 'dead_letter' else 'pending' end,
      available_at = now() + make_interval(secs => least(300, ((retries + 1) * 15))),
      dead_lettered_at = case when retries + 1 >= 8 then now() else dead_lettered_at end,
      payload = jsonb_set(payload, '{last_error}', to_jsonb(coalesce(p_error_message, 'unknown')))
  where id = p_outbox_id
  returning retries into v_retries;

  return jsonb_build_object('ok', true, 'retries', coalesce(v_retries, 0));
end;
$$ language plpgsql security definer;

alter table public.ingress_buffer enable row level security;
alter table public.event_outbox enable row level security;

create policy ingress_buffer_select_admin on public.ingress_buffer
for select using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

create policy event_outbox_select_admin on public.event_outbox
for select using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));
