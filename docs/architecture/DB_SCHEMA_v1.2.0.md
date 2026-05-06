<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# DB Schema Summary

**Version:** v1.2.0
**Last Updated:** 2026-04-04

The core schema is established in `supabase/migrations/202603270001_core_schema.sql` and extended by 28 subsequent migrations covering identity, league core, stats, streaming, commerce, media, ops, and governance domains.

## Design Principles

- UUID primary keys + audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) on all domain tables.
- Idempotency keys on all mutating workflows.
- `touch_updated_at` trigger on all domain tables.
- RLS enabled on every public schema table — enforced by `trg_auto_enable_rls` event trigger (20260404200000).
- SQL RPC functions for onboarding, stats, stream gating, commerce, and ops review.

## Tables by Domain

### Identity & RBAC

| Table | Purpose |
|---|---|
| `profiles` | User profile (display name, bio, avatar, subscription_ends_at, onboarding_completed_at) |
| `user_role_assignments` | Role grants per user/league — `(user_id, league_id, role)` unique |
| `devices` | Session device tracking (last_seen_at) |
| `audit_logs` | Privileged action audit trail (actor_id, action, ref_type, ref_id, payload) |

### League Core

| Table | Purpose |
|---|---|
| `leagues`, `seasons`, `divisions` | Organizational hierarchy |
| `teams`, `team_memberships` | Team roster management |
| `players` | Player profiles linked to teams/leagues/users |
| `schedule_slots` | Game scheduling time slots |
| `games` | Games with home/away scores, status lifecycle |
| `game_rosters` | Per-game player activation |
| `league_events` | League-wide event calendar (20260402000300) |

### Stats

| Table | Purpose |
|---|---|
| `stat_categories` | Stat metric definitions (PTS, REB, AST, etc.) |
| `stat_line_submissions` | Draft → finalized stat payloads per game |
| `player_game_stats` | Individual player box scores |
| `mvw_standings` | **Materialized view** — pre-aggregated W/L/pts per (league, season, team). Refreshed CONCURRENTLY via `trg_games_refresh_standings` when game status → `final`. Unique index on `(league_id, season_id, team_id)` required for concurrent refresh. (20260404230000) |

### Streaming

| Table | Purpose |
|---|---|
| `stream_admin_config` | Live stream state (is_live, collection_id) |
| `stream_sessions` | Stream lifecycle (peak_viewers, started_at, ended_at) |
| `stream_entitlements` | PPV access grants (user_id, game_id, status, expires_at) |
| `stream_access_sessions` | Active viewer sessions with heartbeat tracking |
| `stream_sources` | Upstream playback URLs (ops-only) |
| `stream_watermark_events` | DRM watermark event log |
| `stream_reactions` | Live emoji/reaction events per game (20260404002000) |
| `stream_chat_messages` | Live chat with moderation — statuses: `active`, `hidden`, `removed`. Length constraint 1–400 chars. (20260404090000) |
| `ppv_invites` | Invite-based PPV access — `id` serves as invite code (UUID). One invite per generator per game. IP-locked on redemption. (20260331000200) |

### Commerce

| Table | Purpose |
|---|---|
| `products`, `product_media` | Product catalog and media assets |
| `carts`, `cart_items` | Shopping cart state |
| `orders`, `payment_attempts` | Order lifecycle and payment tracking |
| `billing_events` | Billing event log |
| `reward_credits` | Promotional/reward credit system |
| `stripe_events` | **Stripe webhook idempotency log** — UNIQUE on `stripe_event_id` (TEXT). Tracks processing status: `processed`, `duplicate`, `failed`, `skipped`. (20260404240000) |

### Ops & Governance

| Table | Purpose |
|---|---|
| `review_queue` | Ops review queue (headshots, submissions) |
| `import_jobs` | Bulk import tracking |
| `coach_approval_requests` | Coach role approval workflow (20260404001000) |
| `ingress_buffer` | Failed ingress quarantine with risk scoring |
| `event_outbox` | Domain event outbox for async processing |
| `api_idempotency_keys` | Worker request deduplication |
| `rls_audit` | **RLS auto-enforcement audit log** — records every table that has RLS auto-enabled by the DDL event trigger. Admin-read-only. (20260404200000) |

### Broadcast & Engagement (20260417100000)

| Table | Purpose |
|---|---|
| `overlay_game_state` | One row per game — period/clock/score/fouls/timeouts/possession/bonus + sponsor-bug flag. Feeds `/overlay/:gameId`. Public read, admin write. Auto-created by `trg_ensure_overlay_state`. |
| `sponsor_slots` | Sponsor assets (name, tagline, logo, colors, weight, league scope, start/end windows). |
| `sponsor_impressions` | Append-only impression + click log. |
| `engagement_polls` | Polls, predictions, trivia with jsonb `options`. Status enum: `draft\|open\|locked\|closed`. |
| `engagement_poll_votes` | Cast votes. UNIQUE `(poll_id, user_id)` enforces one vote per user. |
| `gamification_points` | Append-only points ledger; `get_gamification_leaderboard(p_limit)` RPC returns top-N with display names. |
| `watch_parties` | Host-created rooms keyed by 6-char `join_code`. |
| `watch_party_members` | UNIQUE `(watch_party_id, user_id)`. |
| `ai_weekly_digest` | Cached narrative recap. UNIQUE `(league_id, week_start)` upserted by worker. |
| `obs_commands` | FIFO queue consumed by on-site `obs-agent`. Status: `pending\|acked\|failed`. |

## Performance Indexes (10K+ Concurrent Users)

Migration `20260404100000_performance_indexes_10k_concurrent.sql` adds 30+ indexes across hot-path tables:

- **RBAC:** `user_role_assignments(user_id, role)`, `(user_id, league_id, role)`
- **Stream access:** `stream_entitlements(user_id, game_id, status)`, `(expires_at) WHERE status='active'`
- **Viewer sessions:** `stream_access_sessions(user_id, expires_at)`, `(game_id, status, expires_at)`
- **PPV invites:** `ppv_invites(id) WHERE used_at IS NULL`, `(game_id)`, `(generated_by)`
- **Live reactions:** `stream_reactions(game_id, created_at DESC)`
- **Commerce:** `orders(user_id, status, created_at DESC)`, `payment_attempts(order_id, status)`
- **Keyset pagination:** `games(created_at DESC)`, `games(status, created_at DESC)`, `import_jobs(created_at DESC)`
- **Event outbox:** `event_outbox(status, created_at) WHERE status='pending'`
- **Idempotency:** `api_idempotency_keys(idempotency_key, created_at)`

## RLS Helper Functions (20260404210000)

Performance-optimized SECURITY DEFINER helpers that cache `auth.uid()` using the `(SELECT auth.uid())` scalar subquery pattern:

| Function | Purpose |
|---|---|
| `fn_user_in_league(uuid)` | Is caller a member of the given league? |
| `fn_user_in_team(uuid)` | Is caller on the given team? |
| `fn_has_any_role(app_role[])` | Does caller have any of the given roles? |
| `fn_is_admin()` | Is caller super_admin or league_admin? |
| `fn_is_own_profile(uuid)` | Does caller's UID match the given user_id? |

## Defensive Migration Patterns

- **Event triggers:** `CREATE EVENT TRIGGER` wrapped in `DO $$ ... EXCEPTION WHEN insufficient_privilege` for Supabase preview branch compatibility. (20260404200000)
- **Materialized view publication:** `ALTER PUBLICATION ... ADD TABLE` on `mvw_standings` catches `wrong_object_type`, `feature_not_supported`, and `undefined_object`. (20260404230000)
- **`IF NOT EXISTS` on all indexes** — migrations are safely idempotent on re-run.
- **Function signature guards:** `to_regprocedure()` NULL check before `ALTER FUNCTION SET search_path`. (20260404000300)
