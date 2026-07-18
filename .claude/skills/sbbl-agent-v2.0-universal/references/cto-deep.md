# SBBL HQ CTO Deep Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 -->

## Stack Canonical

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Vite + React 18 + TypeScript (strict) | NOT Next.js |
| Styling | Tailwind CSS (dark-first) + Framer Motion | 60fps animations |
| Virtualization | react-window v2 | Stats/Leaderboards ≥50 rows |
| PWA | VitePWA + Workbox | `navigateFallback: '/offline'` |
| Captcha | Cloudflare Turnstile | Invisible, execute-on-demand |
| Backend | Cloudflare Workers (`sbbl-hq-worker`) | wrangler.jsonc → sbbl-hq.icu |
| DB | Supabase (PostgreSQL 15 + Realtime + Auth + Storage) | Self-hosted AWS EC2 |
| Payments | Stripe (Checkout + webhooks via Supabase Edge Function) | |
| Mobile | Capacitor (iOS + Android) | codemagic.yaml CI |
| Monitoring | Sentry + UptimeRobot | 5% trace sampling on Worker |
| Testing | Vitest + istanbul + Playwright + k6 | 80+ test files |
| CI/CD | GitHub Actions (13 workflows) | |

## Context Providers

| Provider | File | Purpose |
|----------|------|---------|
| `AppContext` | `src/contexts/AppContext.tsx` | League selection, stats, UI state |
| `AuthContext` | `src/contexts/AuthContext.tsx` | Supabase auth session, role enrichment, Sentry user tagging |
| `BagContext` | `src/contexts/BagContext.tsx` | Shopping bag state — isolated to prevent unrelated re-renders |

## Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useTurnstile` | `src/hooks/use-turnstile.ts` | Turnstile widget lifecycle: `{ containerRef, resolveToken, ready }` |
| `useLiveAccess` | `src/hooks/...` | Resolves broadcast/stream access gate state |

## Data Model: Core Relations

```
League → Season → Division → Team → Player
League → Season → Game (home_team, away_team, status, scores)
Game → GameRoster → Player
Game → PlayerGameStats (PTS, REB, AST, STL, BLK, etc.)
Game → StreamAssignment → Stream (stream_url, source_platform)
Stream → StreamEntitlement (user_id, game_id, status='active', expires_at)
Stream → StreamAccessSession (heartbeat tracking)
League → Season → mvw_standings (materialized, refreshed on game.status → 'final')
```

## Complete DB Table Inventory

### Identity & RBAC
- `profiles` — display_name, bio, avatar, subscription_ends_at, onboarding_completed_at
- `user_role_assignments` — (user_id, league_id, role) UNIQUE
- `devices` — session device tracking
- `audit_logs` — privileged action audit trail

### League Core
- `leagues`, `seasons`, `divisions` — org hierarchy
- `teams`, `team_memberships` — roster mgmt
- `players` — linked to teams/leagues/users
- `schedule_slots` — game scheduling time slots
- `games` — home/away scores, status lifecycle
- `game_rosters` — per-game player activation
- `league_events` — league-wide event calendar
- `stat_categories` — PTS, REB, AST, STL, BLK metric defs
- `stat_line_submissions` — draft → finalized payloads
- `player_game_stats` — individual box scores
- `mvw_standings` — materialized view, refreshed CONCURRENTLY by trigger

### Streaming & Broadcast
- `stream_admin_config` — is_live, collection_id (SUPER_ADMIN only)
- `stream_sessions` — peak_viewers, started_at, ended_at
- `stream_entitlements` — PPV access grants (status = 'active')
- `stream_access_sessions` — active viewer sessions + heartbeat
- `stream_sources` — upstream playback URLs (ops-only)
- `stream_watermark_events` — DRM watermark log
- `stream_reactions` — live emoji per game
- `stream_chat_messages` — live chat (status: active/hidden/removed, 1–400 chars)
- `ppv_invites` — invite-based PPV (game_id is TEXT, may = 'broadcast')
- `stream_assignments` — game ↔ stream junction (is_active)

### Commerce (Store v1)
- `products`, `product_media` — product catalog + media
- `carts`, `cart_items` — shopping cart state
- `orders`, `payment_attempts` — order lifecycle
- `billing_events` — billing event log
- `reward_credits` — promotional credit system
- `stripe_events` — webhook idempotency (UNIQUE on stripe_event_id)

### Engagement & Broadcast
- `overlay_game_state` — period/clock/score/fouls/timeouts/possession/bonus/sponsor per game
- `sponsor_slots` — sponsor assets (name, tagline, logo, colors, weight)
- `sponsor_impressions` — append-only impression + click log
- `engagement_polls` — polls/predictions/trivia (status: draft|open|locked|closed)
- `engagement_poll_votes` — UNIQUE (poll_id, user_id)
- `gamification_points` — append-only points ledger
- `watch_parties` — host-created rooms (6-char join_code)
- `watch_party_members` — UNIQUE (watch_party_id, user_id)
- `ai_weekly_digest` — cached AI recap (UNIQUE league_id + week_start)
- `obs_commands` — FIFO OBS agent queue (status: pending|acked|failed)

### Media & Content
- `media_publications` — media assets (pinned, archived, sort_order)
- `highlight_clips` — game highlights (game_id nullable)

### Fan Economy
- `fan_tokens` — token catalog (products)
- `fan_token_transactions` — purchase/award ledger

### Biometrics
- `biometric_snapshots` — heart rate, HRV, other biometric data points

### Replay
- `replay_entitlements` — paid replay access per user per game

### Shadow Events
- `shadow_events` — event sourcing shadow for core domain events

### Ops & Governance
- `review_queue` — headshot/submission review
- `import_jobs` — bulk import tracking
- `coach_approval_requests` — coach role approval workflow
- `ingress_buffer` — failed ingress quarantine + risk scoring
- `event_outbox` — domain event outbox (status: pending/processed)
- `api_idempotency_keys` — request dedup + OmniBridge replay prevention
- `rls_audit` — DDL trigger auto-enforcement log

## Key RPCs

| RPC | Purpose |
|-----|---------|
| `get_active_broadcast()` | Single access oracle for broadcast state + stream URL |
| `get_stats_dashboard(...)` | Player stats with league filter |
| `get_leaderboards(...)` | Top player rankings |
| `mark_order_paid(...)` | Order fulfillment |
| `finalize_game_stats(...)` | Box score finalization |
| `complete_fan_onboarding(p_display_name, p_full_name, p_preferred_league)` | Fan-specific onboarding |
| `can_user_view_stream(p_game_id text, p_user_id uuid)` | PPV access check (named args!) |
| `create_stream_entitlement(...)` | PPV entitlement creation (status='active') |
| `redeem_ppv_invite(...)` | Invite code redemption |
| `admin_sync_broadcast_to_sessions()` | Sync go-live to viewer tables |
| `log_admin_action(...)` | OmniBridge + admin audit trail |
| `bulk_archive_media_publications(...)` | Transactional bulk archive |
| `get_gamification_leaderboard(p_limit)` | Top-N engagement leaderboard |
| `heartbeat_batch_upsert(...)` | Stream session heartbeat |

## Performance: 10K+ Concurrent Users Indexes

Migration `20260404100000_performance_indexes_10k_concurrent.sql` — 30+ indexes including:
- RBAC: `user_role_assignments(user_id, role)`, `(user_id, league_id, role)`
- Stream access: `stream_entitlements(user_id, game_id, status)`, `(expires_at) WHERE status='active'`
- Viewer sessions: `stream_access_sessions(user_id, expires_at)`, `(game_id, status, expires_at)`
- PPV invites: `ppv_invites(id) WHERE used_at IS NULL`
- Live reactions: `stream_reactions(game_id, created_at DESC)`
- Commerce: `orders(user_id, status, created_at DESC)`
- Event outbox: `event_outbox(status, created_at) WHERE status='pending'`

## Vite Bundle Chunks

Manual chunks in `vite.config.ts` (long-lived vendor splits):
`react-vendor` · `supabase-vendor` · `ui-vendor` · `media-vendor` · `utils-vendor` · `query-vendor`
Tree-shaken (excluded from bundle guard): `charts-vendor` · `rxdb-vendor` · `forms-vendor`

## Validation Gate Commands

```bash
npm run typecheck   # strict TS across app + node configs
npm run lint        # ESLint --max-warnings 0
npm test            # Vitest unit+integration (≥80% coverage, 100% new code)
npm run build       # Vite production build
npm run cf:deploy   # Deploy to Cloudflare Workers (production)
npm run simulate:broadcast  # Walk 19 URLs through full ingest pipeline
```

## Test File Quick-Reference

| Test File | Coverage |
|-----------|----------|
| `src/test/no-mock-in-production.test.ts` | Mock import guard |
| `src/test/live-stream-player-regressions.test.ts` | 11 player invariants (mutation-tested) |
| `src/test/worker-stream-hardening.test.ts` | 5 broadcast alias access path tests |
| `src/test/armageddon-stream-invariants.test.ts` | Stream independence contract |
| `src/test/stream-chaos-battery.test.ts` | Stream chaos scenarios |
| `src/worker/tests/omnihub-bridge.integration.test.ts` | 14 OmniBridge integration tests |
| `src/test/paywall-rbac-audit.test.ts` | Paywall RBAC audit |
| `src/test/worker-stripe-ppv.test.ts` | PPV purchase flow |
| `src/test/stream-20k-stress.test.ts` | 20K concurrent stream stress |
| `tests/k6/` | Load tests: auth spike, checkout burst, live page, webhook stress |
| `tests/e2e/` | Playwright E2E: broadcast live, paywall evidence |
