# Security Model

- Secrets are server-only and validated at runtime in `src/lib/env.ts`.
- Worker API enforces auth headers, role checks, and idempotency keys for all mutations.
- Supabase RLS is enabled across non-public tables.
- Admin paths (`/ops/*`) require league admin or higher.
- All privileged actions are designed to log to `audit_logs`.

## Rate Limiting & Bot Protection
- **Signup Endpoint:** Protected via Cloudflare Turnstile to drop automated bot traffic at the edge before hitting the Supabase Auth APIs. The Turnstile token is validated on account creation.
- **Thundering Herd:** The React `AuthContext` caches the active session in `sessionStorage` with a stale-while-revalidate pattern to prevent mass concurrent database profile queries during high traffic events.
