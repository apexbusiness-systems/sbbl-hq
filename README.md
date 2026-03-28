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
- Progressive Web App (manifest + service worker) with install prompt UX
- Capacitor wrapper support for native iOS/Android packaging

See deployment and schema docs for production handoff.

## Custom domain TLS troubleshooting

If your Cloudflare zone still has legacy A/AAAA records to previous hosting, apex TLS can fail with `ERR_SSL_PROTOCOL_ERROR`. Use Worker custom domains and remove conflicting legacy proxied origin records. See `DEPLOY_CLOUDFLARE.md` for step-by-step remediation.

## PWA + Capacitor workflow

- Build and sync native shells: `npm run cap:sync`
- Copy web bundle to existing native shells: `npm run cap:copy`
- Open iOS project (Xcode): `npm run cap:open:ios`
- Open Android project (Android Studio): `npm run cap:open:android`
- Detailed setup: `PWA_CAPACITOR_SETUP.md`
