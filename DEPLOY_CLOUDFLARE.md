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
