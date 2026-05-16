# Self-hosted Supabase production contract

Production Supabase for SBBL-HQ is self-hosted. Do not use Supabase Cloud project refs or hosted-only assumptions for production.

## Runtime identity

- Production app public Supabase URL: `SUPABASE_URL` in the Worker runtime and `VITE_SUPABASE_URL` only for explicit build/test fallback. Current production config target is `https://supabase.sbbl-hq.icu`.
- `/api/public-config` exposes only the public Supabase URL and public publishable/anon key. It must never expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`.
- Browser/client code may only use `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, or `VITE_SUPABASE_ANON_KEY`.
- Secret/service-role key is server-only and only allowed after existing privileged auth checks. `/ops/validation-runs` requires existing `super_admin` auth before its validation-run service-role client is created.

## Ownership model

JR is the sole super-admin unless repo policy changes. Do not add a multi-admin threat model, new auth system, or new permission layer without an explicit policy change.

Self-hosted Supabase operational ownership includes OS/service updates, Docker service updates, Postgres maintenance, backups/restore, monitoring, uptime, and disaster recovery. Supabase Cloud branching, managed PITR, hosted project refs, and platform API workflows are not production assumptions for SBBL-HQ.

## Required Cloudflare secrets

Set existing server-side secrets with Wrangler; do not commit them to plaintext vars:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put GROQ_API_KEY
```

Only set `TURNSTILE_SECRET_KEY`, `OMNIHUB_API_KEY`, or `SENTRY_AUTH_TOKEN` when the corresponding existing integration is enabled.

## Validation commands

Run these from the Supabase host when server access exists:

```bash
docker compose ps
docker compose logs kong --tail=100
docker compose logs auth --tail=100
docker compose logs rest --tail=100
docker compose logs realtime --tail=100
docker compose logs storage --tail=100
docker compose logs db --tail=100
```

Run these from a networked operator shell:

```bash
curl -i "$SUPABASE_PUBLIC_URL/rest/v1/"
curl -i "$SUPABASE_PUBLIC_URL/auth/v1/"
curl -i "$SUPABASE_PUBLIC_URL/storage/v1/"
curl -i "$SUPABASE_PUBLIC_URL/realtime/v1/"
```

Expected `401`, `403`, `404`, or gateway errors can still prove routing exists; record exact status/body in the release report.
