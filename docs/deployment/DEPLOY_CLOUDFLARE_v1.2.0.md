<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# Cloudflare Deployment

**Version:** v1.2.0
**Last Updated:** 2026-04-04

## Local

1. Copy `.env.example` to `.env`.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Run `npm run dev` for UI.
4. Run `npx wrangler dev` for worker route checks.

## Production

1. Ensure Cloudflare credentials are present (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`).
2. Set secrets with `wrangler secret put` for service-role and provider keys.
3. Run gate: `npm run build && npm run typecheck && npm run test`.
4. Deploy: `npm run cf:deploy`.

### Worker Name

The worker name in `wrangler.jsonc` is **`sbbl-hq-worker`** (changed from `sbbl-hq` as of 2026-04-04). This affects Cloudflare dashboard navigation and CLI deploy targets.

## Staging

- Deploy with `npm run cf:deploy:staging` and staging secrets.
- Staging environment (`sbbl-hq-staging`) defined in `wrangler.jsonc`.

## Custom domain

- Attach route/domain in Cloudflare dashboard after first deploy.
- For Workers custom domains, do **not** leave legacy proxied A/AAAA origin records pointing to old hosting.
- Use Worker custom domain routes (configured in `wrangler.jsonc`) and keep apex/www DNS managed by Cloudflare Worker route attachment.
- If you see `ERR_SSL_PROTOCOL_ERROR`, check:
  1. Remove or disable legacy proxied A/AAAA records for apex that point to previous provider origin IPs.
  2. Ensure `sbbl-hq.icu/*` and `www.sbbl-hq.icu/*` are attached as Worker custom domains.
  3. Set SSL/TLS mode to **Full (strict)** after valid edge cert is active.
  4. Keep Cloudflare proxy enabled on the Worker-attached hostname and verify no conflicting origin service on same hostname.
  5. Validate with `curl -I https://sbbl-hq.icu` and `curl -I https://www.sbbl-hq.icu`.

## Offline Mode (PWA)

The VitePWA plugin generates a service worker with:
- `navigateFallback: '/offline'` — serves the offline page when network is unavailable.
- Denylist: `/api`, `/auth`, `/webhooks` routes are excluded from SW interception.
- Precache: 49+ entries from the build output.

The offline page (`src/pages/Offline.tsx`) provides links to cached routes (Schedule, Scores, Leaderboards). An `OfflineBanner` component shows when `navigator.onLine === false`.

## Sentry Integration

- **Client:** `VITE_SENTRY_DSN` enables `@sentry/react`. Source maps uploaded on build when `SENTRY_AUTH_TOKEN` is set.
- **Worker:** `SENTRY_DSN` in `wrangler.jsonc` vars enables `@sentry/cloudflare` with 5% trace sampling.

## Rollback

- Use Cloudflare dashboard deployment history and rollback to prior Worker version.
- Dashboard path: Workers & Pages → `sbbl-hq-worker` → Deployments.

---

## ENV VAR REFERENCE

### Build-time (Vite — baked into dist/ bundle)

| Variable | Value | Where to set |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://SBBL_SUPABASE_PROJECT_REF.supabase.co` | GitHub Secret + `.env` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` anon JWT from Supabase dashboard | GitHub Secret + `.env` |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key | GitHub Secret + `.env` (optional) |
| `VITE_SENTRY_DSN` | Sentry DSN | GitHub Secret + `.env` (optional) |

**`VITE_SUPABASE_ANON_KEY` is the CANONICAL variable.** `VITE_SUPABASE_PUBLISHABLE_KEY` is a deprecated alias.

### Worker runtime (Cloudflare — NOT baked into bundle)

| Variable | Where to set |
|---|---|
| `SUPABASE_URL` | `wrangler.jsonc` vars block (non-secret, already set) |
| `SUPABASE_PUBLISHABLE_KEY` | `wrangler.jsonc` vars block (non-secret, already set) |
| `SENTRY_DSN` | `wrangler.jsonc` vars block (non-secret, already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` |
| `STRIPE_SECRET_KEY` | `wrangler secret put STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | `wrangler secret put STRIPE_WEBHOOK_SECRET` |
| `OPTIONAL_TURNSTILE_SECRET_KEY` | `wrangler secret put OPTIONAL_TURNSTILE_SECRET_KEY` |
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` |

### Why two sets?
- **Vite vars** are for the browser bundle — Supabase client runs client-side, needs the anon key baked in.
- **Worker vars** are for the Cloudflare Worker — service role key never goes to the browser.
- The `/api/public-config` endpoint intentionally does NOT expose these keys (by design). The client reads them from the build bundle only.
