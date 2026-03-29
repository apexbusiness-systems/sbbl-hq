# SBBL HQ

Three-league basketball super app by APEX Business Systems Ltd., Edmonton, Alberta, Canada.

**Leagues:** WBL (Weekend Basketball League) · TGIF League · SBBL Spring Edition

**Live at:** [sbbl-hq.icu](https://sbbl-hq.icu)

---

## Stack

- **Frontend:** Vite + React + TypeScript strict
- **Styling:** Tailwind CSS (dark-first, `#C9A84C` gold accent)
- **Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
- **Hosting:** Cloudflare Workers — NOT Vercel
- **Payments:** Stripe
- **CI/CD:** GitHub Actions → Cloudflare deploy

---

## ⚠️ ENV VARS — AGENTS READ THIS FIRST

Two separate systems. Mixing them breaks auth.

### Build-time (Vite — browser bundle)
Set in `.env` locally. Set as GitHub Actions Secrets in CI.

```
VITE_SUPABASE_URL=https://ezanilxygnpucwkwpsoc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   ← anon JWT from Supabase dashboard → Project Settings → API
```

> `VITE_SUPABASE_ANON_KEY` is canonical. `VITE_SUPABASE_PUBLISHABLE_KEY` is a dead alias. Never use it.

### Worker runtime (Cloudflare — never browser)
Set in `.dev.vars` locally. Set via `wrangler secret put` in production.

```
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
```

---

## Quick Start

```bash
npm install
cp .env.example .env        # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
cp .dev.vars.example .dev.vars  # fill in service keys
npm run dev
```

## Quality Gates (must all pass before merge)

```bash
npm run lint        # zero warnings
npm run typecheck   # zero errors
npm run test        # ≥80% coverage
npm run build       # zero errors
npx playwright test # smoke suite passes
```

## Deploy

```bash
npm run cf:deploy           # production
npm run cf:deploy:staging   # staging
```

## Docs

- [`docs/architecture.md`](docs/architecture.md) — stack, data model, env var system
- [`docs/onboarding/DEVELOPER_ONBOARDING_v1.0.0.md`](docs/onboarding/DEVELOPER_ONBOARDING_v1.0.0.md) — new dev setup
- [`docs/runbooks/OPERATIONS_RUNBOOK_v1.0.0.md`](docs/runbooks/OPERATIONS_RUNBOOK_v1.0.0.md) — deploy + ops SOP
- [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md) — Cloudflare-specific deploy steps + env var reference
