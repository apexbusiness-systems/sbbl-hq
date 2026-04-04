# SBBL-HQ Release Gate Audit — 10K Concurrency Hardening

**Date:** 2026-04-04  
**Scope:** Full-stack 10K+ concurrent users audit: security hardening, performance indexing, credential hygiene, deployment config  
**Gate Decision: PASS — all internal code blockers resolved**

---

## Session 2026-04-04: Hardening Pass (This Session)

### Commits Applied

| Commit | Summary |
|--------|----------|
| `a790eec` | security: harden worker index.ts — fix roles header, security headers, CSP |
| `4be466a` | security: remove hardcoded Supabase credentials from rxdb.ts |
| `d8554bf` | perf(db): add 30 critical indexes for 10K+ concurrent user throughput |
| `7e3042e` | chore: add wrangler.toml with Pages/Worker config, assets binding, staging env |

### Security Fixes

1. **Hardcoded credentials purged from `src/lib/rxdb.ts`** — removed hardcoded Supabase URL and publishable key fallbacks; added explicit `throw` if env vars are absent at build time.
2. **Worker `index.ts` hardened** — roles header reads from verified session header (`x-sbbl-roles-verified`), not user-controlled headers; CSP and security headers strengthened.
3. **`wrangler.toml` created** — deployment config committed with proper Pages binding, staging environment, and observability; no secrets in TOML.

### Performance Fixes (10K+ Concurrency)

30 new database indexes added across critical hot-path tables:

- `user_role_assignments(user_id, role)` — every RBAC check
- `stream_entitlements(user_id, game_id, status)` — every stream access check
- `stream_entitlements(expires_at) WHERE status='active'` — partial index for expiry queries
- `stream_access_sessions(user_id, expires_at)` — heartbeat/playback checks
- `ppv_invites(token) WHERE used_at IS NULL` — token redemption hot path
- `stream_reactions(game_id, created_at DESC)` — live event write volume
- `players(user_id)`, `players(team_id)`, `players(league_id)` — roster lookups
- `games(status, published)` — public schedule queries
- `orders(user_id, status, created_at DESC)` — billing dashboard
- `audit_logs(actor_id, created_at DESC)` — ops panel
- `omniport_outbox(status, created_at) WHERE status='pending'` — worker dequeue
- `worker_idempotency(idempotency_key, expires_at)` — dedup at scale
- + 17 additional indexes on team_memberships, game_rosters, devices, review_queue, payment_attempts, billing_events, schedule_slots

### Infrastructure

- `wrangler.toml` now committed — enables reproducible `wrangler deploy` and `wrangler dev` without undocumented config drift
- Staging environment (`sbbl-hq-staging`) defined separately from production
- Observability enabled at 10% head sampling for Cloudflare Logpush

---

# Release Gate Audit (Current Iteration)

Date: 2026-03-27
Scope: Worker runtime, auth/session integrity, idempotency durability, and API workflow execution.

## Resolved blockers

1. Worker dynamic route extraction is deterministic and keyed by declared param names.
2. Mutation idempotency is enforced using a durable Supabase-backed key registry (`api_idempotency_keys`) with transient fallback.
3. Session path now supports Supabase bearer token verification and enriches downstream auth context.
4. Stats/leaderboards and stat draft/finalize routes call real database RPCs instead of mock acknowledgements.
5. Profile gating re-render instability fixed with memoized view model.
6. Player tier renewal lifecycle is persisted in browser local state.

## Remaining non-code prerequisites (external only)

- Set deploy secrets in Cloudflare for production runtime.
- Attach production custom domain.
- Run production acceptance QA with live provider credentials.

## Gate decision

- No internal code blockers remain for staging promotion.
- Production go-live is blocked only by external secret/binding and final acceptance execution.
