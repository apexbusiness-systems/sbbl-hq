-- ── PPV INVITE SYSTEM ─────────────────────────────────────────────────────────
-- Migration: 20260331000200_ppv_invites.sql
-- Target release: April 2
-- Adds: paid_fan role value, ppv_invites table, updated can_user_view_stream RPC
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend app_role enum with paid_fan
--    ALTER TYPE … ADD VALUE is safe inside a transaction on PostgreSQL 12+
--    (Supabase runs PG 15).
alter type public.app_role add value if not exists 'paid_fan';

-- 2. ppv_invites table
--    id           — the invite code itself (UUID, hard to guess)
--    game_id      — which game this invite unlocks
--    generated_by — user who created the invite (must be player/paid_fan/super_admin)
--    used_by      — user who redeemed it (NULL until first use)
--    ip_address   — IP locked on first redemption (derived server-side via CF-Connecting-IP)
--    used_at      — when it was first redeemed
--    expires_at   — 24-hour window from creation (default)
--    UNIQUE (generated_by, game_id) — rate-limit: exactly 1 invite per generator per game

create table if not exists public.ppv_invites (
  id            uuid        primary key default gen_random_uuid(),
  game_id       uuid        not null references public.games(id) on delete cascade,
  generated_by  uuid        not null,  -- auth.uid() of the generator; no FK to auth.users for perf
  used_by       uuid,                  -- NULL until redeemed
  ip_address    text,                  -- locked to redeemer's IP on first use
  used_at       timestamptz,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now(),
  -- DB-level rate limit: 1 invite per generator per game
  unique (generated_by, game_id)
);

create index if not exists idx_ppv_invites_game_id    on public.ppv_invites (game_id);
create index if not exists idx_ppv_invites_used_by    on public.ppv_invites (used_by);
create index if not exists idx_ppv_invites_expires_at on public.ppv_invites (expires_at);
create index if not exists idx_ppv_invites_generator  on public.ppv_invites (generated_by, game_id);

-- 3. RLS
--    All DML goes through the worker with the service-role key (bypasses RLS).
--    The two SELECT policies below allow generators to see their own codes
--    and redeemers to confirm their own grant — no direct user writes are permitted.

alter table public.ppv_invites enable row level security;

drop policy if exists "ppv_invites_owner_select"    on public.ppv_invites;
drop policy if exists "ppv_invites_redeemer_select" on public.ppv_invites;

-- Generator: can read the invite they created (to display the code)
create policy "ppv_invites_owner_select"
  on public.ppv_invites
  for select
  to authenticated
  using (generated_by = auth.uid());

-- Redeemer: can read an invite they have already used (for re-entry confirmation)
create policy "ppv_invites_redeemer_select"
  on public.ppv_invites
  for select
  to authenticated
  using (used_by = auth.uid());

-- 4. Update can_user_view_stream to grant access via invite redemption in addition
--    to the existing stream_entitlements path.
--    The function is called from the worker (service-role) — security definer is fine.

create or replace function public.can_user_view_stream(
  p_game_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Path A: paid PPV entitlement (Stripe purchase → webhook → create_stream_entitlement)
  if exists (
    select 1
    from   public.stream_entitlements
    where  game_id  = p_game_id
      and  user_id  = p_user_id
      and  status   = 'active'
      and  (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  -- Path B: invite-based access (redeemed, not expired, owned by this user)
  if exists (
    select 1
    from   public.ppv_invites
    where  game_id   = p_game_id
      and  used_by   = p_user_id
      and  expires_at > now()
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- 5. RLS policy on live_games view
--    The live_games data is served through the worker (service-role), so no
--    direct-client RLS policy is required.  The comment below documents the
--    intended access rule for auditors:
--
--    Access to a live stream is permitted when ANY of these is true:
--      a) user has role 'player'                          — always free
--      b) user has role 'paid_fan' or 'super_admin'       — always free
--      c) stream_entitlements has an active, non-expired row for (game_id, user_id)
--      d) ppv_invites has a used, non-expired row for (game_id, used_by = user_id)
--         AND ip_address matches the current request IP   — enforced in worker, not DB
--    Enforcement of (d)'s IP check is done in the /api/invite/redeem worker handler;
--    once redeemed the invite row is locked to that IP and user combination.
