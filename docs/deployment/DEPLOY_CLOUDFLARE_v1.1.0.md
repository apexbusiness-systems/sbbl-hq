<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# Cloudflare Deployment

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

## Staging
- Deploy with `npm run cf:deploy:staging` and staging secrets.

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

## Rollback
- Use Cloudflare dashboard deployment history and rollback to prior Worker version.

---

## ⚠️ ENV VAR REFERENCE — READ THIS BEFORE TOUCHING AUTH

### Build-time (Vite — baked into dist/ bundle)

| Variable | Value | Where to set |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://ezanilxygnpucwkwpsoc.supabase.co` | GitHub Secret + `.env` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` anon JWT from Supabase dashboard | GitHub Secret + `.env` |

**`VITE_SUPABASE_ANON_KEY` is the CANONICAL variable.** `VITE_SUPABASE_PUBLISHABLE_KEY` is a deprecated alias — the fallback exists in `runtime-config.ts` but it must never be the primary.

These MUST be set as **GitHub Actions secrets** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and injected during the `npm run build` step. If they are missing at build time, `configAvailable` will be `false` and the login page will show "Authentication temporarily unavailable."

### Worker runtime (Cloudflare — NOT baked into bundle)

| Variable | Where to set |
|---|---|
| `SUPABASE_URL` | `wrangler.jsonc` vars block (non-secret, already set) |
| `SUPABASE_PUBLISHABLE_KEY` | `wrangler.jsonc` vars block (non-secret, already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` |
| `STRIPE_SECRET_KEY` | `wrangler secret put STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | `wrangler secret put STRIPE_WEBHOOK_SECRET` |
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` |

### Why two sets?
- **Vite vars** are for the browser bundle — Supabase client runs client-side, needs the anon key baked in.
- **Worker vars** are for the Cloudflare Worker — service role key never goes to the browser.
- The `/api/public-config` endpoint intentionally does NOT expose these keys (by design). The client reads them from the build bundle only.
