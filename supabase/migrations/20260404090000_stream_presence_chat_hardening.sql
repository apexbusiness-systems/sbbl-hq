-- Stream presence + chat hardening (additive)

-- 1) Stream access sessions: allow non-entitlement sessions for privileged users,
--    track game + lifecycle for true concurrent viewer counting.
alter table public.stream_access_sessions
  alter column entitlement_id drop not null;

alter table public.stream_access_sessions
  add column if not exists game_id uuid references public.games(id),
  add column if not exists status text not null default 'active',
  add column if not exists last_seen_at timestamptz not null default now();

-- Backfill game_id where we can infer it from entitlement
update public.stream_access_sessions sas
set game_id = se.game_id
from public.stream_entitlements se
where sas.entitlement_id = se.id
  and sas.game_id is null;

create index if not exists idx_stream_access_sessions_active_game
  on public.stream_access_sessions(game_id, status, expires_at);

create index if not exists idx_stream_access_sessions_user_game
  on public.stream_access_sessions(user_id, game_id, status);

-- 2) Stream sessions analytics columns (no destructive changes)
alter table public.stream_sessions
  add column if not exists peak_viewers integer not null default 0,
  add column if not exists current_viewers integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

update public.stream_sessions
set started_at = coalesce(started_at, created_at),
    ended_at = case when status = 'ended' then coalesce(ended_at, updated_at) else ended_at end
where started_at is null or (status = 'ended' and ended_at is null);

create index if not exists idx_stream_sessions_game_status
  on public.stream_sessions(game_id, status, updated_at desc);

-- 3) Live chat comments with moderation state
create table if not exists public.stream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null,
  message text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint stream_chat_messages_status_chk check (status in ('active','hidden','removed')),
  constraint stream_chat_messages_length_chk check (char_length(trim(message)) between 1 and 400)
);

create index if not exists idx_stream_chat_messages_room
  on public.stream_chat_messages(game_id, status, created_at desc);

create index if not exists idx_stream_chat_messages_user
  on public.stream_chat_messages(user_id, created_at desc);

alter table public.stream_chat_messages enable row level security;

drop policy if exists "stream_chat_messages_room_read" on public.stream_chat_messages;
drop policy if exists "stream_chat_messages_owner_read" on public.stream_chat_messages;

create policy "stream_chat_messages_room_read"
  on public.stream_chat_messages
  for select
  to authenticated
  using (status = 'active');

create policy "stream_chat_messages_owner_read"
  on public.stream_chat_messages
  for select
  to authenticated
  using (user_id = auth.uid());
