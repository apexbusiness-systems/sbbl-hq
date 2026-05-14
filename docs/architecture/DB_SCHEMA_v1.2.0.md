<!-- Version: v1.3.0 | Date: 2026-05-13 | Status: Current -->
# DB Schema Summary

**Version:** v1.3.0
**Last Updated:** 2026-05-13

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

### Media

| Table | Purpose |
|---|---|
| `media_assets` | Raw media asset storage (images, videos, articles) |
| `media_publications` | Published media with surface targeting, scheduling, and parser intelligence flags (see full column definition below) |

#### `media_publications` — Full Column Reference

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique publication identifier |
| `media_asset_id` | `uuid` | `NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE` | Linked media asset; UNIQUE with `surface` |
| `surface` | `text` | `NOT NULL CHECK (surface IN ('media_feed','store','potg','event','score','feature'))` | Target display surface; UNIQUE with `media_asset_id` |
| `league_id` | `uuid` | `NULL REFERENCES leagues(id)` | Optional league scope |
| `title` | `text` | `NOT NULL` | Publication title |
| `subtitle` | `text` | `NULL` | Optional subtitle |
| `status` | `text` | `NOT NULL CHECK (status IN ('draft','scheduled','published','archived'))` | Publication lifecycle status |
| `published_at` | `timestamptz` | `NULL` | When the publication went live |
| `scheduled_at` | `timestamptz` | `NULL` | Scheduled publish time |
| `sort_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Sort ordering timestamp |
| `render_payload` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Rendering configuration payload |
| `pinned_at` | `timestamptz` | `DEFAULT NULL` | When pinned; non-NULL = pinned, NULL = not pinned |
| `needs_review` | `boolean` | `DEFAULT FALSE` | Parser flagged for manual review (NOT a status value) |
| `parser_confidence` | `real` | `DEFAULT NULL` | Parser confidence score 0–1; NULL if not parsed |
| `parser_uncertain_fields` | `text[]` | `DEFAULT NULL` | Array of field names the parser was uncertain about |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last modification timestamp (maintained by `touch_updated_at` trigger) |

**RLS policies:**
- `super_admin_full_access` — full CRUD for `super_admin` role
- `public_read_published` — public SELECT where `status = 'published'`

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
- **Media (v1.3.0):** `idx_media_publications_pinned` on `(pinned_at) WHERE pinned_at IS NOT NULL` (partial — pinned items only), `idx_media_publications_stale_cleanup` on `(status, published_at, pinned_at, updated_at) WHERE status = 'published'` (composite partial — stale cleanup scan), `idx_media_publications_title_lower` on `(lower(title))` (expression index — prefix search)

## RPC Functions (v1.3.0)

| Function | Signature | Purpose |
| --- | --- | --- |
| `bulk_archive_media_publications` | `(p_ids uuid[]) → void` | Validates all IDs exist in `media_publications` and none are pinned (`pinned_at IS NULL`). Atomically sets `status = 'archived'` on all validated rows. Raises exception `invalid_ids` with the set of missing IDs if any are not found. Raises exception `pinned_ids` with the set of pinned IDs if any have `pinned_at IS NOT NULL`. Both validations run before any mutation. (v1.3.0) |

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
