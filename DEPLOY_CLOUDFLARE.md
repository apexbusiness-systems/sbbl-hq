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

## Rollback
- Use Cloudflare dashboard deployment history and rollback to prior Worker version.
