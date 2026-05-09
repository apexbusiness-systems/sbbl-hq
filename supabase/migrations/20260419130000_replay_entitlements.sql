-- =============================================================================
-- Migration: Replay tier on stream_entitlements (WS7)
-- Date:      2026-04-19
-- Owner:     Stream Platform
--
-- Adds `replay_tier` to stream_entitlements so live and replay
-- entitlements can coexist for the same (user_id, game_id) pair.
-- Canonical values: 'live' (default, matches pre-WS7 behavior),
-- 'raw', 'edited'.
--
-- Purely additive. No drops, no NOT NULL changes. Existing rows default
-- to 'live' so pre-WS7 entitlements continue to gate live playback and
-- are never mistaken for replay access.
-- =============================================================================

alter table public.stream_entitlements
  add column if not exists replay_tier text not null default 'live'
  check (replay_tier in ('live','raw','edited'));

-- Hot query: "does this user have a valid replay entitlement for this game?"
create index if not exists idx_stream_entitlements_replay_lookup
  on public.stream_entitlements(user_id, game_id, replay_tier, expires_at desc)
  where replay_tier <> 'live';
