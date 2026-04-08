<!-- Version: v1.0.0 | Date: 2026-04-04 | Status: Current -->
# LampStand (repository currently contains SBBL HQ code)

Three-league basketball super app by APEX Business Systems Ltd., Edmonton, Alberta

**Leagues:** WBL (Weekend Basketball League) · TGIF League · SBBL Spring Edition

**Live at:** [sbbl-hq.icu](https://sbbl-hq.icu)

---

## Architecture Snapshot

- **Frontend:** Vite + React + TypeScript
- **Styling:** Tailwind CSS (dark-first, `#C9A84C` gold accent)
- **Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
- **Hosting:** Cloudflare Workers — NOT Vercel
- **Payments:** Stripe
- **CI/CD:** GitHub Actions → Cloudflare deploy
- **Auth modes:** guest mode + Supabase auth (password, magic link, Google OAuth)
- **Consent model:** local-first opt-in consent state in browser storage

## Provider and runtime design

- AI provider adapters and voice runtime are not present in this repository today.
- Current architecture remains modular around API clients (`src/lib/api/*`) and Worker routes (`src/worker/*`).
- Groq is currently used only in specific Worker routes where configured by `GROQ_API_KEY`.

---

## ⚠️ ENV VARS — AGENTS READ THIS FIRST

2 separate systems. Mixing them breaks auth.

### Build-time (Vite — browser bundle)
Set in `.env` locally. Set as GitHub Actions Secrets in CI.

```
VITE_SUPABASE_URL=https://ezanilxygnpucwkwpsoc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   ← anon JWT from Supabase dashboard → Project Settings → API
```

> Both `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` are supported.
> The code prefers `VITE_SUPABASE_PUBLISHABLE_KEY` and falls back to `VITE_SUPABASE_ANON_KEY`.
> Either works — they resolve to the same Supabase anon/publishable key.

### Worker runtime (Cloudflare - never browser)
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

## Auth and privacy behavior

- Users can continue in guest mode without forced sign-in.
- Email magic link flow is supported from the login page.
- Local memory, cloud sync, notifications, and microphone are explicit opt-in toggles.
- Reset control clears local consent and local history keys.
- Legal routes: `/privacy`, `/terms`, `/acceptable-use`, `/ai-disclaimer`, `/license`.

## Cloudflare deployment (non-interactive CI-safe)

- Wrangler is pinned in `devDependencies`.
- Use explicit config (`wrangler.jsonc` and `wrangler.toml`) instead of relying on auto-detection.
- Build output is `dist` and configured for SPA fallback in Wrangler assets.
- Deploy commands:
  - `npm run cf:deploy`
  - `npm run cf:deploy:staging`

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

## Documentation

All documentation lives in [`docs/`](docs/README.md). Key entry points:

| Category | Document |
|---|---|
| Architecture | [Architecture Overview](docs/architecture/ARCHITECTURE_v1.1.0.md) · [DB Schema](docs/architecture/DB_SCHEMA_v1.1.0.md) · [API Reference](docs/architecture/API_REFERENCE_v1.1.0.md) |
| Security | [Security Model](docs/security/SECURITY_MODEL_v1.1.0.md) · [RLS Matrix](docs/security/RLS_MATRIX_v1.1.0.md) |
| Operations | [Operations Runbook](docs/operations/OPERATIONS_RUNBOOK_v1.2.0.md) · [External Bindings](docs/operations/EXTERNAL_BINDINGS_v1.0.0.md) |
| Deployment | [Supabase Setup](docs/deployment/SUPABASE_SETUP_v1.1.0.md) · [Cloudflare Deploy](docs/deployment/DEPLOY_CLOUDFLARE_v1.1.0.md) · [PWA + Capacitor](docs/deployment/PWA_CAPACITOR_SETUP_v1.1.0.md) |
| Onboarding | [Developer Onboarding](docs/onboarding/DEVELOPER_ONBOARDING_v1.0.0.md) |
| Quality | [Release Gate Audit](docs/quality/RELEASE_GATE_AUDIT_2026-04-04_v1.1.0.md) |

→ **[Full documentation index](docs/README.md)**
