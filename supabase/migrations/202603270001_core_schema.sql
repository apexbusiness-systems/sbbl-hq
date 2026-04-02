create extension if not exists "pgcrypto";

create type public.app_role as enum ('fan','player','team_manager','league_admin','media_operator','store_operator','super_admin');
create type public.publish_status as enum ('draft','ready','published','archived');
create type public.review_status as enum ('pending','resolved','dismissed');
create type public.validation_result as enum ('accepted','accepted_with_warning','review_required','rejected');
create type public.stat_submission_status as enum ('draft','submitted','under_review','finalized');
create type public.entitlement_status as enum ('locked','preview','purchased','active','expired');

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  full_name text,
  bio text,
  avatar_url text,
  profile_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  league_id uuid,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(user_id, league_id, role)
);

create or replace function public.has_any_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_role_assignments
    where user_id = auth.uid() and role = any(roles)
  )
$$;

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_name text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  ref_type text,
  ref_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  name text not null,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(league_id, name)
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(season_id, name)
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(venue_id, name)
);
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  division_id uuid references public.divisions(id),
  name text not null,
  status public.publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(season_id, name)
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(team_id, user_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  profile_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  league_id uuid references public.leagues(id),
  jersey_number int,
  position text,
  height text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.player_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  payload jsonb not null,
  status public.review_status not null default 'pending',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(user_id, idempotency_key)
);

create table if not exists public.player_profile_headshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  original_asset_id uuid,
  cropped_asset_id uuid,
  validation_result public.validation_result not null default 'review_required',
  review_reason text,
  status public.review_status not null default 'pending',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(player_id, idempotency_key)
);

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  venue_id uuid references public.venues(id),
  court_id uuid references public.courts(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  schedule_slot_id uuid references public.schedule_slots(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  status text not null default 'scheduled',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.game_rosters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(game_id, player_id)
);

create table if not exists public.stat_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.stat_line_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  payload jsonb not null,
  status public.stat_submission_status not null default 'draft',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(game_id, idempotency_key)
);
create table if not exists public.player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  player_id uuid not null references public.players(id),
  pts int not null default 0,
  reb int not null default 0,
  ast int not null default 0,
  stl int not null default 0,
  blk int not null default 0,
  fls int not null default 0,
  min numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(game_id, player_id)
);
create table if not exists public.team_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  team_id uuid not null references public.teams(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(game_id, team_id)
);
create table if not exists public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(league_id, season_id, idempotency_key)
);

create table if not exists public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.stream_sources (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  source_label text not null,
  source_url text not null,
  is_public_source boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.stream_entitlements (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  user_id uuid not null,
  order_id uuid,
  status public.entitlement_status not null default 'purchased',
  expires_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(game_id, user_id, idempotency_key)
);
create table if not exists public.stream_access_sessions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.stream_entitlements(id),
  user_id uuid not null,
  expires_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(user_id, idempotency_key)
);
create table if not exists public.stream_watermark_events (
  id uuid primary key default gen_random_uuid(),
  stream_access_session_id uuid not null references public.stream_access_sessions(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id),
  name text not null,
  status public.publish_status not null default 'published',
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  sku text not null unique,
  color text,
  size text,
  stock_qty int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'active',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(user_id, idempotency_key)
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id),
  variant_id uuid not null references public.product_variants(id),
  qty int not null check (qty > 0),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  variant_id uuid references public.product_variants(id),
  qty int not null,
  unit_price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  user_id uuid not null,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  provider text not null,
  provider_ref text,
  status text not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credit_cost int not null,
  status public.publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.reward_catalog(id),
  user_id uuid not null,
  status text not null default 'granted',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(reward_id, user_id, idempotency_key)
);
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent int check (discount_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.purchase_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entitlement_type text not null,
  ref_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id),
  title text not null,
  status public.publish_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id),
  game_id uuid references public.games(id),
  start_seconds int,
  end_seconds int,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.share_assets (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid references public.clips(id),
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid references public.media_assets(id),
  destination text not null,
  status text not null default 'queued',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.social_destinations (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  network text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(handle, network)
);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  review_type text not null,
  ref_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status public.review_status not null default 'pending',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.rule_conflicts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id),
  title text not null,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  ref_type text not null,
  ref_id uuid,
  decision text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists idx_seasons_league_id on public.seasons(league_id);
create index if not exists idx_divisions_lookup on public.divisions(league_id, season_id);
create index if not exists idx_teams_lookup on public.teams(league_id, season_id);
create index if not exists idx_games_lookup on public.games(league_id, season_id, status);
create index if not exists idx_schedule_slots_lookup on public.schedule_slots(league_id, season_id, starts_at);
create index if not exists idx_entitlements_lookup on public.stream_entitlements(user_id, game_id);
create index if not exists idx_orders_lookup on public.orders(user_id, status);
create index if not exists idx_profiles_search on public.profiles using gin (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(full_name,'')));

create or replace function public.enforce_idempotency(p_idempotency_key text) returns void as $$
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'idempotency key required';
  end if;
end;
$$ language plpgsql;

create or replace function public.log_admin_action(p_action text, p_ref_type text, p_ref_id uuid, p_payload jsonb, p_idempotency_key text)
returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.audit_logs(actor_id, action, ref_type, ref_id, payload, idempotency_key)
  values (auth.uid(), p_action, p_ref_type, p_ref_id, coalesce(p_payload, '{}'::jsonb), p_idempotency_key);
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.enqueue_review_item(p_type text, p_ref_id uuid, p_payload jsonb, p_idempotency_key text) returns jsonb as $$
declare v_id uuid;
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.review_queue(review_type, ref_id, payload, idempotency_key, created_by, updated_by)
  values (p_type, p_ref_id, coalesce(p_payload, '{}'::jsonb), p_idempotency_key, auth.uid(), auth.uid())
  on conflict do nothing
  returning id into v_id;
  perform public.log_admin_action('enqueue_review_item', 'review_queue', v_id, p_payload, p_idempotency_key);
  return jsonb_build_object('ok', true, 'review_item_id', v_id);
end;
$$ language plpgsql security definer;

create or replace function public.resolve_review_item(p_review_item_id uuid, p_resolution text, p_reason text, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  update public.review_queue set status = case when p_resolution='resolve' then 'resolved'::public.review_status else 'dismissed'::public.review_status end, updated_by = auth.uid()
  where id = p_review_item_id;
  perform public.log_admin_action('resolve_review_item', 'review_queue', p_review_item_id, jsonb_build_object('resolution', p_resolution, 'reason', p_reason), p_idempotency_key);
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_user_profile() returns trigger as $$
begin
  insert into public.profiles(user_id, display_name, full_name, created_by, updated_by)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.id, new.id)
  on conflict(user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.complete_player_onboarding(p_payload jsonb, p_idempotency_key text) returns jsonb as $$
declare v_player_id uuid;
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.player_registration_submissions(user_id, payload, idempotency_key, created_by, updated_by)
  values (auth.uid(), p_payload, p_idempotency_key, auth.uid(), auth.uid())
  on conflict do nothing;
  insert into public.players(user_id, jersey_number, position, height, created_by, updated_by)
  values (auth.uid(), nullif(p_payload->>'jersey_number','')::int, p_payload->>'position', p_payload->>'height', auth.uid(), auth.uid())
  on conflict(user_id) do update set jersey_number = excluded.jersey_number, position = excluded.position, height = excluded.height, updated_by = auth.uid()
  returning id into v_player_id;
  perform public.log_admin_action('complete_player_onboarding', 'players', v_player_id, p_payload, p_idempotency_key);
  return jsonb_build_object('ok', true, 'player_id', v_player_id);
end;
$$ language plpgsql security definer;

create or replace function public.submit_player_headshot(p_player_id uuid, p_asset_id uuid, p_validation jsonb, p_idempotency_key text) returns jsonb as $$
declare v_id uuid;
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.player_profile_headshots(player_id, original_asset_id, cropped_asset_id, validation_result, status, idempotency_key, created_by, updated_by)
  values (p_player_id, p_asset_id, p_asset_id, coalesce((p_validation->>'result')::public.validation_result, 'review_required'), 'pending', p_idempotency_key, auth.uid(), auth.uid())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'headshot_id', v_id);
end;
$$ language plpgsql security definer;

create or replace function public.approve_or_reject_headshot(p_headshot_id uuid, p_decision text, p_reason text, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  update public.player_profile_headshots
  set status = case when p_decision='approve' then 'resolved'::public.review_status else 'dismissed'::public.review_status end,
      review_reason = p_reason,
      updated_by = auth.uid()
  where id = p_headshot_id;
  perform public.log_admin_action('approve_or_reject_headshot', 'player_profile_headshots', p_headshot_id, jsonb_build_object('decision', p_decision, 'reason', p_reason), p_idempotency_key);
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.create_game_stat_sheet(p_game_id uuid, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.stat_line_submissions(game_id, payload, status, idempotency_key, created_by, updated_by)
  values (p_game_id, jsonb_build_object('rows', '[]'::jsonb), 'draft', p_idempotency_key, auth.uid(), auth.uid())
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'game_id', p_game_id);
end;
$$ language plpgsql security definer;

create or replace function public.save_stat_draft(p_game_id uuid, p_payload jsonb, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.stat_line_submissions(game_id, payload, status, idempotency_key, created_by, updated_by)
  values (p_game_id, p_payload, 'draft', p_idempotency_key, auth.uid(), auth.uid())
  on conflict(game_id, idempotency_key) do update set payload = excluded.payload, updated_by = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.finalize_game_stats(p_game_id uuid, p_payload jsonb, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  update public.stat_line_submissions set status = 'finalized', payload = p_payload, updated_by = auth.uid() where game_id = p_game_id;
  perform public.log_admin_action('finalize_game_stats', 'games', p_game_id, p_payload, p_idempotency_key);
  return jsonb_build_object('ok', true, 'game_id', p_game_id);
end;
$$ language plpgsql security definer;

create or replace function public.recompute_leaderboards(p_league_id uuid, p_season_id uuid, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.leaderboard_snapshots(league_id, season_id, payload, idempotency_key, created_by, updated_by)
  values (p_league_id, p_season_id, jsonb_build_object('generated_at', now()), p_idempotency_key, auth.uid(), auth.uid())
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.get_stats_dashboard(p_filters jsonb) returns jsonb as $$ begin
  return jsonb_build_object('ok', true, 'filters', coalesce(p_filters, '{}'::jsonb));
end; $$ language plpgsql security definer;
create or replace function public.get_leaderboards(p_filters jsonb) returns jsonb as $$ begin
  return jsonb_build_object('ok', true, 'filters', coalesce(p_filters, '{}'::jsonb));
end; $$ language plpgsql security definer;

create or replace function public.create_stream_entitlement(p_game_id uuid, p_user_id uuid, p_order_id uuid, p_expires_at timestamptz, p_idempotency_key text) returns jsonb as $$
declare v_id uuid;
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.stream_entitlements(game_id, user_id, order_id, status, expires_at, idempotency_key, created_by, updated_by)
  values (p_game_id, p_user_id, p_order_id, 'active', p_expires_at, p_idempotency_key, auth.uid(), auth.uid())
  on conflict(game_id, user_id, idempotency_key) do update set status = excluded.status
  returning id into v_id;
  return jsonb_build_object('ok', true, 'entitlement_id', v_id);
end;
$$ language plpgsql security definer;
create or replace function public.can_user_view_stream(p_game_id uuid, p_user_id uuid) returns boolean as $$
begin
  return exists(select 1 from public.stream_entitlements where game_id=p_game_id and user_id=p_user_id and status='active' and (expires_at is null or expires_at > now()));
end;
$$ language plpgsql security definer;
create or replace function public.begin_stream_access_session(p_game_id uuid, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  return jsonb_build_object('ok', true, 'game_id', p_game_id);
end;
$$ language plpgsql security definer;
create or replace function public.expire_stream_access_sessions(p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  update public.stream_access_sessions set expires_at = now() where expires_at > now();
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;

create or replace function public.create_cart_for_user(p_idempotency_key text) returns jsonb as $$
declare v_id uuid;
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.carts(user_id, idempotency_key, created_by, updated_by) values (auth.uid(), p_idempotency_key, auth.uid(), auth.uid())
  on conflict(user_id, idempotency_key) do update set updated_by = auth.uid() returning id into v_id;
  return jsonb_build_object('ok', true, 'cart_id', v_id);
end;
$$ language plpgsql security definer;
create or replace function public.add_cart_item(p_cart_id uuid, p_variant_id uuid, p_qty int, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.cart_items(cart_id, variant_id, qty, idempotency_key, created_by, updated_by)
  values (p_cart_id, p_variant_id, p_qty, p_idempotency_key, auth.uid(), auth.uid());
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
create or replace function public.remove_cart_item(p_cart_id uuid, p_item_id uuid, p_idempotency_key text) returns jsonb as $$
begin
  perform public.enforce_idempotency(p_idempotency_key);
  delete from public.cart_items where cart_id = p_cart_id and id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
create or replace function public.create_order_from_cart(p_cart_id uuid, p_idempotency_key text) returns jsonb as $$ begin
  perform public.enforce_idempotency(p_idempotency_key);
  return jsonb_build_object('ok', true, 'cart_id', p_cart_id);
end; $$ language plpgsql security definer;
create or replace function public.mark_order_paid(p_order_id uuid, p_payment_ref text, p_idempotency_key text) returns jsonb as $$ begin
  perform public.enforce_idempotency(p_idempotency_key);
  update public.orders set status='paid', updated_by=auth.uid() where id=p_order_id;
  return jsonb_build_object('ok', true, 'payment_ref', p_payment_ref);
end; $$ language plpgsql security definer;
create or replace function public.grant_reward_credit(p_user_id uuid, p_reward_id uuid, p_idempotency_key text) returns jsonb as $$ begin
  perform public.enforce_idempotency(p_idempotency_key);
  insert into public.reward_claims(reward_id, user_id, idempotency_key, created_by, updated_by) values (p_reward_id, p_user_id, p_idempotency_key, auth.uid(), auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true);
end; $$ language plpgsql security definer;
create or replace function public.redeem_reward_credit(p_user_id uuid, p_reward_id uuid, p_idempotency_key text) returns jsonb as $$ begin
  perform public.enforce_idempotency(p_idempotency_key);
  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'reward_id', p_reward_id);
end; $$ language plpgsql security definer;

DO $$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles','user_role_assignments','devices','audit_logs','leagues','seasons','divisions','venues','courts','teams','team_memberships','players','player_registration_submissions','player_profile_headshots','game_rosters','schedule_slots','games','stat_categories','stat_line_submissions','player_game_stats','team_game_stats','leaderboard_snapshots','stream_sessions','stream_sources','stream_entitlements','stream_access_sessions','stream_watermark_events','products','product_variants','carts','cart_items','orders','order_items','invoices','payment_attempts','billing_events','reward_catalog','reward_claims','promo_codes','purchase_entitlements','media_assets','clips','share_assets','publish_jobs','social_destinations','review_queue','rule_conflicts','moderation_events','sync_events'
  ] loop
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I;', tbl, tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at();', tbl, tbl);
  end loop;
end $$;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select using (profile_public = true or user_id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (user_id = auth.uid());
drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders for select using (user_id = auth.uid());
drop policy if exists orders_self_mutate on public.orders;
create policy orders_self_mutate on public.orders for update using (user_id = auth.uid());
drop policy if exists headshots_self_read on public.player_profile_headshots;
create policy headshots_self_read on public.player_profile_headshots for select using (exists(select 1 from public.players p where p.id = player_id and p.user_id = auth.uid()));
drop policy if exists registration_self_write on public.player_registration_submissions;
create policy registration_self_write on public.player_registration_submissions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (status = 'published');
drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets for select using (status = 'published');
drop policy if exists schedules_public_read on public.games;
create policy schedules_public_read on public.games for select using (published = true);

insert into storage.buckets (id, name, public)
values
  ('player-headshots','player-headshots', false),
  ('league-media','league-media', true),
  ('highlight-clips','highlight-clips', true),
  ('store-products','store-products', true),
  ('share-assets','share-assets', true),
  ('private-docs','private-docs', false)
on conflict (id) do nothing;
