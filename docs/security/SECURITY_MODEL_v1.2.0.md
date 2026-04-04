<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# Security Model

**Version:** v1.2.0
**Last Updated:** 2026-04-04

## Runtime Environment Security

- Secrets are server-only and validated at runtime in `src/lib/env.ts` (z-schema validation).
- Worker API enforces auth headers, role checks, and idempotency keys for all mutations.
- Admin paths (`/ops/*`) require `league_admin` or higher via `requireSuperAdmin()`.
- All privileged actions log to `audit_logs`.

## Row-Level Security

- RLS is enabled across **all** public schema tables — no exceptions.
- **Auto-enforcement:** DDL event trigger `trg_auto_enable_rls` (20260404200000) automatically enables RLS on any new table created in the `public` schema and logs to `rls_audit`. Wrapped in exception handler for Supabase preview branch compatibility.
- **Policy optimization:** All hot-path RLS policies use the `(SELECT auth.uid())` scalar subquery pattern — executed once per query instead of once per row. (20260404210000)

### SECURITY DEFINER Helper Functions

Centralized, cached membership checks used across RLS policies:

| Function | Purpose | Inline Equivalent |
|---|---|---|
| `fn_user_in_league(uuid)` | League membership check | `EXISTS (SELECT 1 FROM user_role_assignments WHERE user_id = auth.uid() AND league_id = $1)` |
| `fn_user_in_team(uuid)` | Team membership check | `EXISTS (SELECT 1 FROM team_memberships WHERE user_id = auth.uid() AND team_id = $1)` |
| `fn_has_any_role(app_role[])` | Role array check | `EXISTS (SELECT 1 FROM user_role_assignments WHERE user_id = auth.uid() AND role = ANY($1))` |
| `fn_is_admin()` | Admin shorthand | `fn_has_any_role(ARRAY['super_admin','league_admin'])` |
| `fn_is_own_profile(uuid)` | Self-service guard | `auth.uid() = $1` |

All helpers are `STABLE`, `SECURITY DEFINER`, and have `SET search_path = public` pinned. Function search paths are hardened in `20260404000300_harden_function_search_paths.sql`.

## Captcha (Cloudflare Turnstile)

- **Client:** `useTurnstile` hook (`src/hooks/use-turnstile.ts`) manages a singleton Turnstile widget in invisible `execution: 'execute'` mode. Shared across Login and LiveStreamPlayer components.
- **Worker:** `verifyTurnstileToken()` validates tokens server-side against `https://challenges.cloudflare.com/turnstile/v0/siteverify` using `OPTIONAL_TURNSTILE_SECRET_KEY`. Returns `true` when no secret key is configured (dev/local safe default). Wrapped in try/catch to prevent captcha API failures from blocking auth.
- **Flows protected:** Sign-in, sign-up, PPV stream purchase, invite redemption.

## Stripe Webhook Security

- **Edge Function** (`supabase/functions/stripe-webhook/index.ts`): HMAC-SHA256 signature verification on raw request bytes using `STRIPE_WEBHOOK_SECRET`.
- **Idempotency:** Duplicate event detection via `stripe_events` table with UNIQUE constraint on `stripe_event_id`.
- **Processing:** Route-separated handlers (registration vs sponsorship) with transactional RPC.

## Worker Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` with strict directives (self, Cloudflare challenges, Stripe, Supabase)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

## Defensive Migration Patterns

- Event trigger creation wrapped in `EXCEPTION WHEN insufficient_privilege` for preview branch safety.
- Materialized view publication wrapped in broad exception handler (`wrong_object_type`, `feature_not_supported`, `undefined_object`).
- All indexes use `IF NOT EXISTS` for idempotent re-runs.
- `to_regprocedure()` guards before `ALTER FUNCTION` to skip missing functions gracefully.
