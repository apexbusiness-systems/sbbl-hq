-- ── Relax ppv_invites.game_id to text ────────────────────────────────────────
-- The Live page uses mock game IDs (e.g. 'g1') that aren't real UUIDs.
-- Drop the FK constraint and change the column to text so invites work
-- with both mock and real game identifiers.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the FK constraint (constraint name from the migration)
alter table public.ppv_invites drop constraint if exists ppv_invites_game_id_fkey;

-- 2. Change column type from uuid to text
alter table public.ppv_invites alter column game_id type text using game_id::text;

-- 3. Also update the can_user_view_stream RPC to accept text game_id
create or replace function public.can_user_view_stream(
  p_game_id text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Path A: paid PPV entitlement
  if exists (
    select 1
    from   public.stream_entitlements
    where  game_id::text = p_game_id
      and  user_id  = p_user_id
      and  status   = 'active'
      and  (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  -- Path B: invite-based access
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
