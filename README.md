# SBBL HQ

SBBL HQ is a premium basketball super app for SBBL, WBL, and TGIFBL with a Cloudflare Worker runtime and Supabase data/auth/storage backend.

## Commands

- `npm run dev` - frontend development
- `npm run build` - production frontend build
- `npm run typecheck` - type checks
- `npm run test` - unit/integration smoke tests
- `npm run cf:deploy` - Cloudflare Worker deploy
- `npm run cf:deploy:staging` - staging deploy
- `npm run db:migrate` - apply Supabase migrations
- `npm run db:types` - generate TS database types

## Architecture

- Premium SPA UI (React + Vite + shadcn)
- Worker-first API paths (`/api/*`, `/auth/*`, `/ops/*`, `/webhooks/*`)
- Supabase Postgres/Auth/Storage with RLS
- Idempotent server mutations using `x-idempotency-key`

See deployment and schema docs for production handoff.
