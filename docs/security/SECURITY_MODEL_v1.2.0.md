<!-- Version: v1.3.0 | Date: 2026-05-21 | Status: Current -->
# Security Model

**Version:** v1.3.0
**Last Updated:** 2026-05-11

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

- **Canonical handler:** Cloudflare Worker route `POST /webhooks/stripe` (`src/worker/index.ts`): HMAC-SHA256 signature verification on raw request bytes using `STRIPE_WEBHOOK_SECRET`. Rate-limited per IP.
- **Archival handler:** Edge Function (`supabase/functions/stripe-webhook/index.ts`) — retained as reference/fallback, not the active ingress path.
- **Idempotency:** Duplicate event detection via `stripe_events` table with UNIQUE constraint on `stripe_event_id`.
- **Processing:** Route-separated handlers (registration vs sponsorship) with transactional RPC.

## Worker Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` with strict directives (self, Cloudflare challenges, Stripe, Supabase); `frame-src` includes `https://www.facebook.com` for the `plugins/video.php` sandboxed iframe embed — `connect.facebook.net` (FB SDK) is intentionally absent from `script-src`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

## OmniBridge Trust Boundary

Added in v1.5.0 (PR #502). The OmniBridge integration introduces a bidirectional channel between SBBL-HQ and APEX-OmniHub. All inbound commands arrive at `POST /webhooks/omnihub`; outbound telemetry is delivered via `POST /sync/drain` → `OMNIHUB_SYNC_URL`.

### Authentication mechanism

All inbound OmniHub commands are authenticated with **HMAC-SHA256** using a shared key. The receiving worker computes `HMAC-SHA256(OMNIHUB_VERIFY_KEY, JSON.stringify(packet))`, encodes the result as base64url, and compares it to the `X-Omni-Signature` request header. A missing or mismatched signature is rejected with `401` before any further processing.

### Risk-lane re-classification (defence-in-depth)

Inbound command payloads are run through a risk-lane classifier after HMAC verification. Payloads whose content matches BLOCKED-lane patterns (e.g. `DROP TABLE`, `ALTER ROLE`, `DISABLE RLS`, `TRUNCATE`, `GRANT ALL PRIVILEGES`) are **always rejected** — even when the HMAC signature is cryptographically valid. This is intentional defence-in-depth: signature validity proves the message came from OmniHub, but it does not override the content-level blast-radius controls.

### Replay attack prevention

- **Idempotency deduplication:** Every accepted command's `X-Omni-Packet-Id` is stored in `api_idempotency_keys`. A replayed packet ID returns `200 already_processed` without re-executing the action. The idempotency check runs before action dispatch.
- **Clock-skew window (±300 s):** Commands whose `timestamp` field falls outside a ±300-second window of the server's current time are rejected with `400`. This prevents an attacker who captures a valid signed command from replaying it at an arbitrary later time.

### Action allowlist (scope creep prevention)

Only 9 actions may be dispatched by an inbound OmniHub command:

```
disable_stream, enable_stream, revoke_access, grant_access,
emergency_halt, broadcast_message, force_man_review, hotfix_dispatch, ping
```

Any action not on this list is rejected with `400 action_not_allowed`. New actions require explicit repo-owner approval and a CLAUDE.md §8 update before implementation.

### Separate inbound / outbound keys (production recommendation)

| Key | Direction | Secret name |
|---|---|---|
| Inbound verify key | OmniHub → SBBL-HQ | `OMNIHUB_VERIFY_KEY` |
| Outbound signing key | SBBL-HQ → OmniHub | `OMNIHUB_SIGNING_SECRET` |

Using distinct key material for each direction limits blast radius on key compromise: a leaked inbound key does not expose the ability to forge outbound telemetry, and vice versa. Sharing a single key is supported in dev/staging (when `OMNIHUB_VERIFY_KEY` is absent, the worker falls back to `OMNIHUB_SIGNING_SECRET` for verification), but must not be used in production.

## Defensive Migration Patterns

- Event trigger creation wrapped in `EXCEPTION WHEN insufficient_privilege` for preview branch safety.
- Materialized view publication wrapped in broad exception handler (`wrong_object_type`, `feature_not_supported`, `undefined_object`).
- All indexes use `IF NOT EXISTS` for idempotent re-runs.
- `to_regprocedure()` guards before `ALTER FUNCTION` to skip missing functions gracefully.
