# SBBL HQ Security Deep Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 -->

## Role Hierarchy

```
SUPER_ADMIN   ← Full platform access, stream_admin_config, admin_sync_broadcast
ADMIN         ← Full CRUD, ops panel, all worker routes
COMMISSIONER  ← League-scoped management
SCOREKEEPER   ← Stat entry only
PLAYER        ← Own stats, stream access (PPV/subscription)
PAID_FAN      ← Paid subscription access
PUBLIC        ← Anonymous read of public endpoints
```

Role storage: `user_role_assignments(user_id, league_id, role)` — UNIQUE per user+league.
Helper: `get_user_role(auth.uid())` — used in RLS policies.

## RLS Iron Law

Every table in the public schema MUST have RLS enabled.

**Auto-enforcement:** `trg_auto_enable_rls` DDL event trigger (migration 20260404200000)
automatically enables RLS on any new table creation.
Audit log: `rls_audit` table — admin-read-only.

```sql
-- RLS bootstrap template for new tables
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all" ON {table} FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- User own rows (if applicable)
CREATE POLICY "user_own_read" ON {table} FOR SELECT
  USING (auth.uid() = user_id);

-- Public read (if applicable)
CREATE POLICY "public_read" ON {table} FOR SELECT
  USING (true);
```

## RLS Helper Functions (migration 20260404210000)

```sql
get_user_role(p_user_id uuid) → text           -- primary role lookup
has_league_role(p_user_id, p_league_id, p_role) → boolean
is_admin(p_user_id uuid) → boolean
is_super_admin(p_user_id uuid) → boolean
```

## Worker Authentication

Every protected route must call `requireAuth(req)`:

```ts
// Worker pattern
const { userId, roles } = await requireAuth(req);
const admin = getAdminClient();  // Supabase service-role — bypasses RLS

// Worker route check
const isAdmin = roles.includes('admin') || roles.includes('super_admin');
const isPlayer = roles.includes('player') || roles.includes('paid_fan');
```

`x-sbbl-user-id-verified` header is set by the auth middleware.
Worker uses service-role client (RLS-free) after verifying the JWT.

## Stripe Security

- Webhook signature verification: `STRIPE_WEBHOOK_SECRET` (constant-time comparison)
- `stripe_events` table: UNIQUE on `stripe_event_id` — idempotency against replay
- `payment_attempts` tracked per order
- Service-role only: `mark_order_paid()` RPC

```ts
// Signature verification (src/worker/stripe-utils.ts)
import { stripe_constant_time_compare } from './stripe-utils';
const isValid = await stripe_constant_time_compare(rawBody, signature, secret);
```

Tests: `src/test/stripe-constant-time-compare.test.ts`, `src/test/stripe-signature-parsing.test.ts`

## Supabase Auth Hardening

- PKCE flow (verified: `src/test/supabase-client-pkce.test.ts`)
- Cloudflare Turnstile captcha on auth endpoints (invisible, execute-on-demand)
- HIBP (HaveIBeenPwned) password check configured
- Session management: `src/test/session-enforcement.test.ts`
- Device tracking: `devices` table (last_seen_at)
- One-device policy: `ONE_DEVICE_POLICY.md`

## OmniBridge Security (see omnibridge-deep.md for full spec)

- HMAC-SHA256 inbound (OMNIHUB_VERIFY_KEY) + outbound (OMNIHUB_SIGNING_SECRET)
- 9-action allowlist — hard-coded, no runtime config
- BLOCKED-lane pattern rejection before any action dispatch
- Idempotency keys prevent replay attacks
- target_source pin: `X-Omni-Source` must equal `"sbbl-hq"`
- Clock-skew window: ±300 seconds
- Every accepted command logged to `audit_logs` via `log_admin_action()`

## Stream Access Security

- PPV entitlements: `stream_entitlements(status='active')` — only 'active' grants access
- Broadcast: registration-only (`onboarding_completed_at IS NOT NULL`)
- Worker validates access independently from DB (defense in depth)
- No client-side access decisions — all gate logic on Worker
- Signed playback tokens: `/api/streams/:gameId/playback-token/verify`

## Search Path Hardening

Migration `20260404000300_harden_function_search_paths.sql`:
All SQL functions have explicit `search_path = public` to prevent schema injection attacks.

## Security Headers (Worker `addSecurityHeaders()`)

Applied to ALL responses (including static HTML via `run_worker_first: true`):
- `Content-Security-Policy` (CSP): locked down; `connect.facebook.net` blocked in `script-src`
- `Permissions-Policy`
- `HSTS`
- `X-Frame-Options`

CSP note: Facebook embeds use `plugins/video.php` iframe — `frame-src` allows `facebook.com`
but `connect.facebook.net` remains blocked in `script-src` (prevents FB SDK loading).

## PIPEDA Compliance (Canadian Privacy Law)

- Data deletion on request
- No third-party data sales
- Cookie consent required
- Privacy policy must be presented before registration
- PII audit: `src/test/` (pii detection tests)

## Ingress Security

- `ingress_buffer`: Failed ingress quarantine with risk scoring
- Risk-lane classification rejects BLOCKED patterns before processing
- Presigned URLs for media uploads (never direct DB access from client)

## Audit Trail

All privileged actions logged to `audit_logs`:
- `actor_id` — who performed the action
- `action` — what was done
- `ref_type`, `ref_id` — what was affected
- `payload` — JSON details
- OmniBridge: every accepted command logged (even no-ops)

## Rate Limiting

- `stream_shared_rate_limit` (migration 20260411100000): shared rate limit across stream access
- Worker V8 isolate rate limiter (no memory leak — fixed post-initial deployment)
- Cloudflare Turnstile: invisible captcha on auth flows
- `stream_validation_system` (migration 20260410120000): validation policy for stream requests
