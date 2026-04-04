-- =============================================================================
-- MIGRATION: 20260404100000_performance_indexes_10k_concurrent.sql
-- PURPOSE: Add critical missing indexes for 10K+ concurrent user support.
-- All indexes use CONCURRENTLY-compatible IF NOT EXISTS pattern.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AUTH / RBAC: user_role_assignments
-- Hot path: every request that calls has_any_role() hits this table.
-- ---------------------------------------------------------------------------
create index if not exists idx_ura_user_role
  on public.user_role_assignments (user_id, role);

create index if not exists idx_ura_user_league_role
  on public.user_role_assignments (user_id, league_id, role);

-- ---------------------------------------------------------------------------
-- PLAYERS: looked up by user_id on every profile / stats / roster query.
-- ---------------------------------------------------------------------------
create index if not exists idx_players_user_id
  on public.players (user_id);

create index if not exists idx_players_team_id
  on public.players (team_id);

create index if not exists idx_players_league_id
  on public.players (league_id);

-- ---------------------------------------------------------------------------
-- GAMES: public schedule + stream gating hot paths.
-- ---------------------------------------------------------------------------
create index if not exists idx_games_status_published
  on public.games (status, published)
  where published = true;

create index if not exists idx_games_home_team
  on public.games (home_team_id);

create index if not exists idx_games_away_team
  on public.games (away_team_id);

create index if not exists idx_games_schedule_slot
  on public.games (schedule_slot_id);

-- ---------------------------------------------------------------------------
-- STREAM ENTITLEMENTS: checked on EVERY stream access attempt.
-- (user_id, game_id) already unique but compound with status for filter-only.
-- ---------------------------------------------------------------------------
create index if not exists idx_stream_ent_user_game_status
  on public.stream_entitlements (user_id, game_id, status);

create index if not exists idx_stream_ent_expires_at
  on public.stream_entitlements (expires_at)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- STREAM ACCESS SESSIONS: expiry checks on every heartbeat / playback ping.
-- ---------------------------------------------------------------------------
create index if not exists idx_stream_access_user_expires
  on public.stream_access_sessions (user_id, expires_at);

create index if not exists idx_stream_access_entitlement
  on public.stream_access_sessions (entitlement_id);

-- ---------------------------------------------------------------------------
-- PPV INVITES: invite redemption + lookup during high-concurrency events.
-- (Table created in 20260331000200_ppv_invites.sql)
-- Columns: id (uuid PK / invite code), generated_by, used_by, game_id, …
-- ---------------------------------------------------------------------------
create index if not exists idx_ppv_invites_id_unused
  on public.ppv_invites (id)
  where used_at is null;

create index if not exists idx_ppv_invites_game_id
  on public.ppv_invites (game_id);

create index if not exists idx_ppv_invites_inviter
  on public.ppv_invites (generated_by);

-- ---------------------------------------------------------------------------
-- STREAM REACTIONS: written at very high volume during live events.
-- (Table created in 20260404002000_stream_reactions.sql)
-- ---------------------------------------------------------------------------
create index if not exists idx_stream_reactions_game_created
  on public.stream_reactions (game_id, created_at desc);

create index if not exists idx_stream_reactions_user
  on public.stream_reactions (user_id, game_id);

-- ---------------------------------------------------------------------------
-- ORDERS / PAYMENTS: user billing dashboards + payment webhook resolution.
-- ---------------------------------------------------------------------------
create index if not exists idx_orders_user_status
  on public.orders (user_id, status, created_at desc);

create index if not exists idx_payment_attempts_order
  on public.payment_attempts (order_id, status);

create index if not exists idx_billing_events_user
  on public.billing_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS: ops dashboard queries by actor + time range.
-- ---------------------------------------------------------------------------
create index if not exists idx_audit_logs_actor_created
  on public.audit_logs (actor_id, created_at desc);

create index if not exists idx_audit_logs_ref
  on public.audit_logs (ref_type, ref_id);

-- ---------------------------------------------------------------------------
-- TEAM MEMBERSHIPS: roster lookups per team.
-- ---------------------------------------------------------------------------
create index if not exists idx_team_memberships_team
  on public.team_memberships (team_id, role);

create index if not exists idx_team_memberships_user
  on public.team_memberships (user_id);

-- ---------------------------------------------------------------------------
-- GAME ROSTERS: per-game player lookups.
-- ---------------------------------------------------------------------------
create index if not exists idx_game_rosters_game
  on public.game_rosters (game_id, active);

create index if not exists idx_game_rosters_player
  on public.game_rosters (player_id);

-- ---------------------------------------------------------------------------
-- PLAYER GAME STATS: leaderboard + stats pipeline queries.
-- ---------------------------------------------------------------------------
create index if not exists idx_player_game_stats_game
  on public.player_game_stats (game_id);

create index if not exists idx_player_game_stats_player_pts
  on public.player_game_stats (player_id, pts desc);

-- ---------------------------------------------------------------------------
-- PROFILES: user lookup by user_id (FK from many tables).
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_user_id
  on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- DEVICES: session management.
-- ---------------------------------------------------------------------------
create index if not exists idx_devices_user_id
  on public.devices (user_id, last_seen_at desc);

-- ---------------------------------------------------------------------------
-- EVENT OUTBOX: worker dequeue hot path.
-- (Table created in 202603290001_omniport_outbox.sql as event_outbox)
-- ---------------------------------------------------------------------------
create index if not exists idx_event_outbox_status_pending
  on public.event_outbox (status, created_at asc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- API IDEMPOTENCY KEYS: deduplicate worker requests at scale.
-- (Table created in 202603270002_worker_idempotency.sql as api_idempotency_keys)
-- Columns: idempotency_key (unique), route, user_id, created_at
-- ---------------------------------------------------------------------------
create index if not exists idx_api_idempotency_keys_key_created
  on public.api_idempotency_keys (idempotency_key, created_at);

-- ---------------------------------------------------------------------------
-- SCHEDULES: public-facing schedule queries with time filtering.
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_slots_starts_at_status
  on public.schedule_slots (starts_at, status);

-- ---------------------------------------------------------------------------
-- REVIEW QUEUE: ops panel pending items.
-- ---------------------------------------------------------------------------
create index if not exists idx_review_queue_status_type
  on public.review_queue (status, review_type, created_at desc)
  where status = 'pending';
