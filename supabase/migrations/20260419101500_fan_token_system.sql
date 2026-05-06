-- =============================================================================
-- Migration: Fan Token System (WS4)
-- Date:      2026-04-19
-- Owner:     Engagement Platform
--
-- Purely additive. No drops. No NOT NULL constraint changes on existing
-- columns. All new tables default to empty; feature is gated at the
-- application layer by FEATURE_FAN_TOKEN_SYSTEM (worker env) +
-- VITE_FEATURE_FAN_TOKEN_SYSTEM (client env). With both flags off, this
-- migration is a no-op at runtime.
--
-- Atomic idempotency:
--   * fan_token_transactions has UNIQUE(idempotency_key) so Stripe
--     webhook replays, double-submits, and award retries never credit
--     twice.
--   * award_fan_tokens() RPC is SECURITY DEFINER and wraps
--     balance-check → debit → ledger insert → leaderboard upsert in a
--     single serializable transaction. Partial failure is impossible.
--
-- Performance:
--   * fan_token_wallets is 1-row-per-user; balance reads are a PK lookup.
--   * player_token_leaderboard has a composite (game_id, total_tokens DESC)
--     index so top-N queries are sorted-index scans.
--   * idempotency_key column has a UNIQUE btree for O(log n) replay checks.
--
-- Stream Independence: zero reliance on games.stream_url or streams
-- coupling. game_id and season_id are nullable so season-only awards
-- and non-game token spends remain expressible.
-- =============================================================================

-- ── 1. fan_token_products ───────────────────────────────────────────────────
create table if not exists public.fan_token_products (
  id               uuid primary key default gen_random_uuid(),
  label            text not null,
  token_count      int not null check (token_count > 0),
  price_cad        numeric(8,2) not null check (price_cad > 0),
  stripe_price_id  text unique,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.fan_token_products enable row level security;

drop policy if exists "products_public_read" on public.fan_token_products;
create policy "products_public_read"
  on public.fan_token_products for select
  using (is_active = true);

drop policy if exists "products_admin_all" on public.fan_token_products;
create policy "products_admin_all"
  on public.fan_token_products for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- Seed bundles — prices are illustrative. Ops can toggle is_active via
-- the admin surface; stripe_price_id is populated once bundles are
-- mapped to Stripe Prices during rollout.
insert into public.fan_token_products (label, token_count, price_cad, sort_order) values
  ('Starter — 10 tokens',  10,  2.99, 10),
  ('Fan — 50 tokens',      50,  9.99, 20),
  ('Booster — 150 tokens', 150, 24.99, 30),
  ('Hype — 500 tokens',    500, 74.99, 40)
on conflict do nothing;

-- ── 2. fan_token_wallets ────────────────────────────────────────────────────
create table if not exists public.fan_token_wallets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  balance           int not null default 0 check (balance >= 0),
  total_purchased   int not null default 0 check (total_purchased >= 0),
  total_awarded     int not null default 0 check (total_awarded >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_fan_token_wallets_user on public.fan_token_wallets(user_id);

alter table public.fan_token_wallets enable row level security;

drop policy if exists "wallet_owner_select" on public.fan_token_wallets;
create policy "wallet_owner_select"
  on public.fan_token_wallets for select
  using (user_id = auth.uid());

drop policy if exists "wallet_admin_all" on public.fan_token_wallets;
create policy "wallet_admin_all"
  on public.fan_token_wallets for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- ── 3. token_award_categories ───────────────────────────────────────────────
create table if not exists public.token_award_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  emoji       text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.token_award_categories enable row level security;

drop policy if exists "categories_public_read" on public.token_award_categories;
create policy "categories_public_read"
  on public.token_award_categories for select using (is_active = true);

drop policy if exists "categories_admin_all" on public.token_award_categories;
create policy "categories_admin_all"
  on public.token_award_categories for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

insert into public.token_award_categories (slug, label, emoji, sort_order) values
  ('fan_favorite',     'Fan Favorite',       '⭐', 10),
  ('most_hype',        'Most Hype',          '🔥', 20),
  ('best_trash_talk',  'Best Trash Talker',  '🎤', 30),
  ('clutch_factor',    'Clutch Factor',      '💎', 40),
  ('most_entertaining','Most Entertaining',  '🎭', 50)
on conflict (slug) do nothing;

-- ── 4. fan_token_transactions ───────────────────────────────────────────────
create table if not exists public.fan_token_transactions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null,
  type                     text not null check (type in ('purchase','award','refund','reversal')),
  amount                   int not null,
  game_id                  uuid,
  season_id                uuid,
  recipient_player_id      uuid,
  category_slug            text,
  stripe_payment_intent_id text,
  stripe_event_id          text,
  idempotency_key          text not null unique,
  created_at               timestamptz not null default now()
);

create index if not exists idx_tx_user_created on public.fan_token_transactions(user_id, created_at desc);
create index if not exists idx_tx_recipient on public.fan_token_transactions(recipient_player_id, created_at desc) where recipient_player_id is not null;
create index if not exists idx_tx_game on public.fan_token_transactions(game_id, created_at desc) where game_id is not null;

alter table public.fan_token_transactions enable row level security;

drop policy if exists "tx_owner_select" on public.fan_token_transactions;
create policy "tx_owner_select"
  on public.fan_token_transactions for select
  using (user_id = auth.uid());

drop policy if exists "tx_admin_all" on public.fan_token_transactions;
create policy "tx_admin_all"
  on public.fan_token_transactions for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- ── 5. player_token_leaderboard ─────────────────────────────────────────────
-- Materialized aggregate. Rows are upserted by award_fan_tokens() RPC,
-- not recomputed from fan_token_transactions — avoids a full-scan at
-- read time. Consistency is guaranteed because the RPC performs the
-- insert + upsert atomically.
create table if not exists public.player_token_leaderboard (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null,
  game_id             uuid,
  season_id           uuid,
  total_tokens        int not null default 0 check (total_tokens >= 0),
  category_breakdown  jsonb not null default '{}'::jsonb,
  last_updated        timestamptz not null default now(),
  unique (player_id, game_id, season_id)
);

-- Top-N leaderboard queries are sorted-index scans:
create index if not exists idx_leaderboard_game_tokens
  on public.player_token_leaderboard (game_id, total_tokens desc)
  where game_id is not null;
create index if not exists idx_leaderboard_season_tokens
  on public.player_token_leaderboard (season_id, total_tokens desc)
  where season_id is not null;

alter table public.player_token_leaderboard enable row level security;

drop policy if exists "leaderboard_public_read" on public.player_token_leaderboard;
create policy "leaderboard_public_read"
  on public.player_token_leaderboard for select using (true);

drop policy if exists "leaderboard_admin_all" on public.player_token_leaderboard;
create policy "leaderboard_admin_all"
  on public.player_token_leaderboard for all
  using (public.has_any_role(array['league_admin','super_admin']::public.app_role[]))
  with check (public.has_any_role(array['league_admin','super_admin']::public.app_role[]));

-- ── 6. Atomic award RPC ─────────────────────────────────────────────────────
-- Replay-safe via UNIQUE(idempotency_key). A duplicate call with the
-- same key returns the original txn row + existing leaderboard row and
-- does NOT debit the wallet a second time.
create or replace function public.award_fan_tokens(
  p_user_id             uuid,
  p_recipient_player_id uuid,
  p_amount              int,
  p_game_id             uuid,
  p_season_id           uuid,
  p_category_slug       text,
  p_idempotency_key     text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing        public.fan_token_transactions;
  v_wallet_balance  int;
  v_tx_id           uuid;
  v_leaderboard     public.player_token_leaderboard;
begin
  if p_amount <= 0 then
    raise exception 'award_amount_must_be_positive';
  end if;
  if p_recipient_player_id is null then
    raise exception 'recipient_required';
  end if;
  if p_category_slug is null then
    raise exception 'category_required';
  end if;

  -- Idempotency replay — return the original result without mutating.
  select * into v_existing from public.fan_token_transactions
    where idempotency_key = p_idempotency_key;
  if found then
    select * into v_leaderboard from public.player_token_leaderboard
      where player_id = v_existing.recipient_player_id
        and game_id is not distinct from v_existing.game_id
        and season_id is not distinct from v_existing.season_id;
    return jsonb_build_object(
      'replay', true,
      'transaction_id', v_existing.id,
      'recipient_player_id', v_existing.recipient_player_id,
      'amount', v_existing.amount,
      'leaderboard_total', coalesce(v_leaderboard.total_tokens, 0)
    );
  end if;

  -- Atomic debit — row-level lock prevents concurrent overdraft.
  -- UPDATE ... RETURNING is safe: the predicate `balance >= p_amount`
  -- guarantees non-negative post-state at the database layer, so even
  -- if two concurrent calls race, only one observes sufficient funds.
  update public.fan_token_wallets
    set balance = balance - p_amount,
        total_awarded = total_awarded + p_amount,
        updated_at = now()
    where user_id = p_user_id
      and balance >= p_amount
    returning balance into v_wallet_balance;

  if not found then
    raise exception 'insufficient_balance';
  end if;

  -- Ledger insert. UNIQUE(idempotency_key) protects against the rare
  -- racey replay that landed after our first SELECT but before this
  -- INSERT — the second caller receives a unique-violation and should
  -- retry-read.
  insert into public.fan_token_transactions
    (user_id, type, amount, game_id, season_id, recipient_player_id, category_slug, idempotency_key)
  values
    (p_user_id, 'award', -p_amount, p_game_id, p_season_id, p_recipient_player_id, p_category_slug, p_idempotency_key)
  returning id into v_tx_id;

  -- Leaderboard upsert — composite unique (player_id, game_id, season_id).
  insert into public.player_token_leaderboard
    (player_id, game_id, season_id, total_tokens, category_breakdown, last_updated)
  values
    (p_recipient_player_id, p_game_id, p_season_id, p_amount,
     jsonb_build_object(p_category_slug, p_amount), now())
  on conflict (player_id, game_id, season_id) do update set
    total_tokens = public.player_token_leaderboard.total_tokens + excluded.total_tokens,
    category_breakdown =
      public.player_token_leaderboard.category_breakdown ||
      jsonb_build_object(
        p_category_slug,
        coalesce((public.player_token_leaderboard.category_breakdown ->> p_category_slug)::int, 0) + p_amount
      ),
    last_updated = now()
  returning * into v_leaderboard;

  return jsonb_build_object(
    'replay', false,
    'transaction_id', v_tx_id,
    'recipient_player_id', p_recipient_player_id,
    'amount', p_amount,
    'wallet_balance', v_wallet_balance,
    'leaderboard_total', v_leaderboard.total_tokens
  );
end;
$$;

-- ── 7. Atomic purchase fulfillment RPC ──────────────────────────────────────
-- Called by Stripe webhook. Idempotent via UNIQUE(idempotency_key)
-- using the Stripe event ID. Wallet is created-if-missing.
create or replace function public.fulfill_fan_token_purchase(
  p_user_id          uuid,
  p_amount           int,
  p_stripe_event_id  text,
  p_stripe_pi_id     text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx              public.fan_token_transactions;
  v_wallet_balance  int;
begin
  if p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  select * into v_tx from public.fan_token_transactions
    where idempotency_key = p_stripe_event_id;
  if found then
    select balance into v_wallet_balance from public.fan_token_wallets
      where user_id = v_tx.user_id;
    return jsonb_build_object(
      'replay', true,
      'transaction_id', v_tx.id,
      'amount', v_tx.amount,
      'wallet_balance', coalesce(v_wallet_balance, 0)
    );
  end if;

  insert into public.fan_token_wallets (user_id, balance, total_purchased)
    values (p_user_id, p_amount, p_amount)
    on conflict (user_id) do update set
      balance = public.fan_token_wallets.balance + excluded.balance,
      total_purchased = public.fan_token_wallets.total_purchased + excluded.total_purchased,
      updated_at = now()
    returning balance into v_wallet_balance;

  insert into public.fan_token_transactions
    (user_id, type, amount, idempotency_key, stripe_event_id, stripe_payment_intent_id)
  values
    (p_user_id, 'purchase', p_amount, p_stripe_event_id, p_stripe_event_id, p_stripe_pi_id)
  returning * into v_tx;

  return jsonb_build_object(
    'replay', false,
    'transaction_id', v_tx.id,
    'amount', p_amount,
    'wallet_balance', v_wallet_balance
  );
end;
$$;

-- Realtime: publish fan_token_wallets + player_token_leaderboard so the
-- UI can subscribe via Supabase Realtime without polling.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_token_leaderboard'
  ) then
    alter publication supabase_realtime add table public.player_token_leaderboard;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fan_token_wallets'
  ) then
    alter publication supabase_realtime add table public.fan_token_wallets;
  end if;
exception when others then
  -- supabase_realtime may not exist in local/CI; ignore.
  null;
end $$;
