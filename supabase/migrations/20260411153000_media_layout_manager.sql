create table if not exists public.media_layout_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  capacity integer not null default 9 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_layout_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.media_layout_sections(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  sort_index integer not null check (sort_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  unique(section_id, sort_index),
  unique(section_id, media_asset_id)
);

create table if not exists public.media_layout_mutations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.media_layout_sections(id) on delete cascade,
  idempotency_key text not null unique,
  payload_hash text not null,
  actor_user_id uuid not null,
  mutation_type text not null check (mutation_type in ('reorder','reset')),
  created_at timestamptz not null default now()
);

create index if not exists idx_media_layout_items_section_sort
  on public.media_layout_items(section_id, sort_index);

create index if not exists idx_media_layout_mutations_section_created_desc
  on public.media_layout_mutations(section_id, created_at desc);

insert into public.media_layout_sections (slug, title, capacity, is_active)
values ('media-page-main', 'Media Page Main Grid', 9, true)
on conflict (slug) do update set title = excluded.title, capacity = excluded.capacity, is_active = excluded.is_active;

alter table public.media_layout_sections enable row level security;
alter table public.media_layout_items enable row level security;
alter table public.media_layout_mutations enable row level security;

drop policy if exists media_layout_sections_public_read on public.media_layout_sections;
create policy media_layout_sections_public_read on public.media_layout_sections
for select using (is_active = true);

drop policy if exists media_layout_items_public_read on public.media_layout_items;
create policy media_layout_items_public_read on public.media_layout_items
for select using (
  exists (
    select 1
    from public.media_layout_sections s
    join public.media_assets ma on ma.id = media_layout_items.media_asset_id
    where s.id = media_layout_items.section_id
      and s.is_active = true
      and ma.status = 'published'
  )
);

drop policy if exists media_layout_mutations_super_admin_read on public.media_layout_mutations;
create policy media_layout_mutations_super_admin_read on public.media_layout_mutations
for select using (auth.jwt() ->> 'role' = 'super_admin');

drop policy if exists media_layout_sections_super_admin_all on public.media_layout_sections;
create policy media_layout_sections_super_admin_all on public.media_layout_sections
for all using (auth.jwt() ->> 'role' = 'super_admin') with check (auth.jwt() ->> 'role' = 'super_admin');

drop policy if exists media_layout_items_super_admin_all on public.media_layout_items;
create policy media_layout_items_super_admin_all on public.media_layout_items
for all using (auth.jwt() ->> 'role' = 'super_admin') with check (auth.jwt() ->> 'role' = 'super_admin');

drop policy if exists media_layout_mutations_super_admin_insert on public.media_layout_mutations;
create policy media_layout_mutations_super_admin_insert on public.media_layout_mutations
for insert with check (
  auth.jwt() ->> 'role' = 'super_admin' and actor_user_id = auth.uid()
);

do $$
begin
  if to_regprocedure('public.touch_updated_at()') is not null then
    execute 'drop trigger if exists trg_media_layout_sections_touch_updated_at on public.media_layout_sections';
    execute 'create trigger trg_media_layout_sections_touch_updated_at before update on public.media_layout_sections for each row execute function public.touch_updated_at()';
    execute 'drop trigger if exists trg_media_layout_items_touch_updated_at on public.media_layout_items';
    execute 'create trigger trg_media_layout_items_touch_updated_at before update on public.media_layout_items for each row execute function public.touch_updated_at()';
  end if;
end $$;

create or replace function public.get_media_layout(p_section_slug text)
returns table (
  section_id uuid,
  section_slug text,
  section_title text,
  section_capacity integer,
  section_updated_at timestamptz,
  media_asset_id uuid,
  sort_index integer
)
language sql
security invoker
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.title,
    s.capacity,
    s.updated_at,
    i.media_asset_id,
    i.sort_index
  from public.media_layout_sections s
  left join public.media_layout_items i on i.section_id = s.id
  where s.slug = p_section_slug and s.is_active = true
  order by i.sort_index asc nulls last;
$$;

create or replace function public.save_media_layout_order(
  p_section_slug text,
  p_ordered_media_asset_ids uuid[],
  p_idempotency_key text,
  p_payload_hash text,
  p_actor_user_id uuid,
  p_expected_section_updated_at timestamptz
)
returns table(
  ok boolean,
  code text,
  section_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section public.media_layout_sections%rowtype;
  v_existing public.media_layout_mutations%rowtype;
  v_has_super_admin boolean;
  v_distinct_count integer;
  v_array_count integer;
begin
  select exists (
    select 1 from public.user_role_assignments where user_id = p_actor_user_id and role = 'super_admin'
  ) into v_has_super_admin;

  if not v_has_super_admin then
    raise exception 'forbidden';
  end if;

  select * into v_section
  from public.media_layout_sections
  where slug = p_section_slug and is_active = true
  for update;

  if v_section.id is null then
    raise exception 'section_not_found';
  end if;

  if p_expected_section_updated_at is not null and v_section.updated_at <> p_expected_section_updated_at then
    raise exception 'stale_revision';
  end if;

  select * into v_existing
  from public.media_layout_mutations
  where idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.payload_hash = p_payload_hash then
      return query select true, 'idempotent_replay', v_section.updated_at;
      return;
    end if;
    raise exception 'idempotency_key_conflict';
  end if;

  v_array_count := coalesce(array_length(p_ordered_media_asset_ids, 1), 0);
  if v_array_count > v_section.capacity then
    raise exception 'capacity_exceeded';
  end if;

  select count(distinct asset_id), count(asset_id)
  into v_distinct_count, v_array_count
  from unnest(coalesce(p_ordered_media_asset_ids, '{}')) as asset_id;

  if v_distinct_count <> v_array_count then
    raise exception 'duplicate_asset_ids';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_ordered_media_asset_ids, '{}')) as aid
    left join public.media_assets ma on ma.id = aid
    where ma.id is null or ma.status <> 'published'
  ) then
    raise exception 'invalid_media_asset_set';
  end if;

  -- Safer rule: reject partial payloads to prevent accidental data loss from
  -- stale clients that submit a subset instead of the current active set.
  if (
    select count(*)
    from public.media_layout_items li
    where li.section_id = v_section.id
  ) > 0 and (
    select count(*) from unnest(coalesce(p_ordered_media_asset_ids, '{}'))
  ) < (
    select count(*)
    from public.media_layout_items li
    where li.section_id = v_section.id
  ) then
    raise exception 'partial_payload_rejected';
  end if;

  delete from public.media_layout_items where section_id = v_section.id;

  insert into public.media_layout_items(section_id, media_asset_id, sort_index, created_by, updated_by)
  select
    v_section.id,
    ordered.asset_id,
    ordered.sort_index,
    p_actor_user_id,
    p_actor_user_id
  from (
    select asset_id, row_number() over () - 1 as sort_index
    from unnest(coalesce(p_ordered_media_asset_ids, '{}')) as asset_id
  ) ordered;

  update public.media_layout_sections
  set updated_at = now()
  where id = v_section.id
  returning * into v_section;

  insert into public.media_layout_mutations(section_id, idempotency_key, payload_hash, actor_user_id, mutation_type)
  values (v_section.id, p_idempotency_key, p_payload_hash, p_actor_user_id, 'reorder');

  return query select true, 'saved', v_section.updated_at;
end;
$$;

create or replace function public.reset_media_layout(
  p_section_slug text,
  p_idempotency_key text,
  p_payload_hash text,
  p_actor_user_id uuid,
  p_expected_section_updated_at timestamptz
)
returns table(
  ok boolean,
  code text,
  section_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section public.media_layout_sections%rowtype;
  v_existing public.media_layout_mutations%rowtype;
  v_has_super_admin boolean;
begin
  select exists (
    select 1 from public.user_role_assignments where user_id = p_actor_user_id and role = 'super_admin'
  ) into v_has_super_admin;

  if not v_has_super_admin then
    raise exception 'forbidden';
  end if;

  select * into v_section
  from public.media_layout_sections
  where slug = p_section_slug and is_active = true
  for update;

  if v_section.id is null then
    raise exception 'section_not_found';
  end if;

  if p_expected_section_updated_at is not null and v_section.updated_at <> p_expected_section_updated_at then
    raise exception 'stale_revision';
  end if;

  select * into v_existing from public.media_layout_mutations where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.payload_hash = p_payload_hash then
      return query select true, 'idempotent_replay', v_section.updated_at;
      return;
    end if;
    raise exception 'idempotency_key_conflict';
  end if;

  delete from public.media_layout_items where section_id = v_section.id;

  update public.media_layout_sections
  set updated_at = now()
  where id = v_section.id
  returning * into v_section;

  insert into public.media_layout_mutations(section_id, idempotency_key, payload_hash, actor_user_id, mutation_type)
  values (v_section.id, p_idempotency_key, p_payload_hash, p_actor_user_id, 'reset');

  return query select true, 'reset', v_section.updated_at;
end;
$$;

grant execute on function public.get_media_layout(text) to anon, authenticated, service_role;
grant execute on function public.save_media_layout_order(text, uuid[], text, text, uuid, timestamptz) to authenticated, service_role;
grant execute on function public.reset_media_layout(text, text, text, uuid, timestamptz) to authenticated, service_role;
