const fs = require('fs');
const file = 'wrangler.jsonc';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "sbbl-hq",`,
  `{
  "$schema": "node_modules/wrangler/config-schema.json",
  // REQUIRED SECRETS — set via \`wrangler secret put <KEY>\` before deploying to production:
  //   SUPABASE_SERVICE_ROLE_KEY   — Supabase service role key (never commit)
  //   STRIPE_SECRET_KEY           — Stripe live/test secret key
  //   STRIPE_WEBHOOK_SECRET       — Stripe webhook signing secret
  //   RESEND_API_KEY              — Resend email API key
  //   GROQ_API_KEY                — Groq Vision API key (enables POTG image parser)
  //   OMNIHUB_SIGNING_SECRET      — OmniHub webhook HMAC signing secret (optional)
  //   OMNIHUB_SYNC_URL            — OmniHub sync endpoint URL (optional)
  "name": "sbbl-hq",`
);

fs.writeFileSync(file, code);
