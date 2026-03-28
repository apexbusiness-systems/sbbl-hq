# Security Model

- Secrets are server-only and validated at runtime in `src/lib/env.ts`.
- Worker API enforces auth headers, role checks, and idempotency keys for all mutations.
- Supabase RLS is enabled across non-public tables.
- Admin paths (`/ops/*`) require league admin or higher.
- All privileged actions are designed to log to `audit_logs`.
