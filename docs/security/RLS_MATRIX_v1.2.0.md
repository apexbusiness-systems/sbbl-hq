<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# RLS Matrix

**Version:** v1.2.0
**Last Updated:** 2026-04-04

All non-public tables have RLS enabled. New tables are automatically protected by the `trg_auto_enable_rls` event trigger (20260404200000).

## Access Matrix

| Table Domain | Tables | Read | Write |
|---|---|---|---|
| **Profiles** | `profiles` | Public if `profile_public=true`; owner always | Owner update via `fn_is_own_profile()` |
| **Products / Media / Games** | `products`, `product_media`, `games`, `leagues`, `seasons`, `teams` | Public when published | Operators/admin via server routes |
| **Orders / Commerce** | `orders`, `payment_attempts`, `billing_events`, `carts`, `cart_items` | Owner only via `(SELECT auth.uid())` | Owner + server-verified payment finalization |
| **Stream Entitlements** | `stream_entitlements`, `stream_access_sessions` | Owner only | Server-side via service role |
| **PPV Invites** | `ppv_invites` | Generator reads own (`generated_by = auth.uid()`); redeemer reads used (`used_by = auth.uid()`) | Service role only (worker) |
| **Player Submissions** | `stat_line_submissions`, `coach_approval_requests` | Owner + admins | Owner submit, admin resolve |
| **Headshots** | `player_headshots` | Owner + admins | Owner submit, admin approve/reject |
| **Review / Ops** | `review_queue`, `import_jobs` | Admins/operators only via `fn_is_admin()` | Admins/operators only |
| **Stream Chat** | `stream_chat_messages` | Authenticated: `status='active'` (room read); owner reads all own | Service role insert (worker) |
| **Stream Reactions** | `stream_reactions` | Authenticated (room read) | Authenticated insert (own user_id) |
| **Stripe Events** | `stripe_events` | Admin read only via `fn_is_admin()` equivalent | Service role only (Edge Function) |
| **RLS Audit** | `rls_audit` | Admin read via `super_admin`/`league_admin` check | Event trigger insert only (SECURITY DEFINER) |
| **Ingress / Outbox** | `ingress_buffer`, `event_outbox` | Admin read via `fn_is_admin()` equivalent | Service role only |
| **Idempotency** | `api_idempotency_keys` | Service role only | Service role only |

## Policy Performance Pattern

All hot-path policies use the `(SELECT auth.uid())` scalar subquery pattern instead of bare `auth.uid()`. This marks the call as a stable init-plan — executed once per query, not once per row.

**Before (slow):**
```sql
USING (user_id = auth.uid())
```

**After (fast):**
```sql
USING (user_id = (SELECT auth.uid()))
```

Applied to: `profiles`, `team_memberships`, `billing_events`, `orders` (20260404210000).

## Helper Functions

Complex membership checks are centralized in SECURITY DEFINER helpers for planner cache efficiency:

- `fn_user_in_league(uuid)` — league membership
- `fn_user_in_team(uuid)` — team membership
- `fn_has_any_role(app_role[])` — role array check
- `fn_is_admin()` — super_admin or league_admin
- `fn_is_own_profile(uuid)` — self-service identity match
