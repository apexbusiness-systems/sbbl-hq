-- Stream Ops admin control state (single-row config)
create table if not exists public.stream_admin_config (
  id boolean primary key default true,
  collection_id text not null default '',
  title text not null default 'SBBL Live Stream',
  source text not null default 'main',
  is_live boolean not null default false,
  active_game_id uuid references public.games(id),
  live_started_at timestamptz,
  live_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

insert into public.stream_admin_config(id)
values (true)
on conflict (id) do nothing;
