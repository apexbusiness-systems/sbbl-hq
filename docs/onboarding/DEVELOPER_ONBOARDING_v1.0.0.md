<!-- Version: v1.0.1 | Date: 2026-04-04 | Status: Current -->
# Developer Onboarding Guide

**Version:** v1.0.1  
**Last Updated (UTC):** 2026-03-29

## 1) Quick Start (15 minutes)

1. Clone repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env files:
   ```bash
   cp .env.example .env
   cp .dev.vars.example .dev.vars
   ```
4. Fill in `.env` — see **Section 6** below before touching any Supabase variable.
5. Start development server:
   ```bash
   npm run dev
   ```
6. Open app and inspect primary pages.

## 2) Project Structure

- `src/pages/` route-level pages.
- `src/components/` shared UI/layout components.
- `src/contexts/` global app context and session state.
- `src/lib/` utilities, auth, API logic.
- `src/test/` Vitest suites.
- `supabase/` migrations and seeds.
- `docs/` operational documentation.

## 3) Required Engineering Workflow

Before every commit:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 4) Coding Standards

- Prefer composable functional React components.
- Keep route components lazy-load compatible.
- Preserve accessibility labels for interactive controls.
- Keep persistent widgets non-intrusive and mobile-safe.

## 5) PR Expectations

- Include rationale and impact summary.
- Include risk assessment and rollback plan for high-risk changes.
- Include test evidence (exact command output snippets).

---

## 6) ⚠️ CANONICAL ENV VARS — READ BEFORE TOUCHING AUTH OR BUILD

This project has **two separate env systems**. Confusing them breaks auth every time.

### A) Build-time (Vite) — baked into the browser bundle

These go in `.env` locally and as **GitHub Actions Secrets** in CI.

| Variable | Description | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT (`eyJ...`) | Supabase dashboard → Project Settings → API |

> **`VITE_SUPABASE_ANON_KEY` is THE canonical variable.** Do not use `VITE_SUPABASE_PUBLISHABLE_KEY` — it is a deprecated alias. The fallback exists in `runtime-config.ts` but must never be set as the primary.

> **If these are missing at build time**, `configAvailable` will be `false` and users will see "Authentication temporarily unavailable." This is the #1 agent mistake on this project.

### B) Worker runtime (Cloudflare) — never in the browser bundle

These go in `.dev.vars` locally and via `wrangler secret put` for production.

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Same URL — but read by the Worker, not the client |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key — Worker-only, non-secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **NEVER expose to browser** |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Email delivery |

### C) CI secrets that must exist in GitHub Actions

Go to: `Settings → Secrets and variables → Actions`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### D) Why `/api/public-config` does NOT return the anon key

By design, the worker's `/api/public-config` endpoint only returns `appName` and `defaultLeague`. The Supabase client is initialized from the **build-time bundle**, not from a runtime API call. This is intentional and must not be changed.
