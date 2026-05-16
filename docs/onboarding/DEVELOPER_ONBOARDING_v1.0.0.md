<!-- Version: v1.1.0 | Date: 2026-05-11 | Status: Current -->
# Developer Onboarding Guide

**Version:** v1.1.0  
**Last Updated (UTC):** 2026-05-11

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
| `VITE_SUPABASE_URL` | Self-hosted Supabase public URL | self-hosted Supabase gateway/Kong public URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT (`eyJ...`) | self-hosted Supabase gateway/Kong public URL |

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

---

## 7) OmniBridge Setup

SBBL-HQ v1.5.0 merged the OmniBridge integration (PR #502), which adds two new worker endpoints and requires three additional Wrangler secrets before the integration will function.

### Required Wrangler secrets

These are **Worker-only** secrets (never in `.env` / browser bundle). Set them via `wrangler secret put` for production, and add them to `.dev.vars` for local development.

| Secret | Description |
|---|---|
| `OMNIHUB_SIGNING_SECRET` | Outbound HMAC-SHA256 signing key — used to sign telemetry envelopes sent from SBBL-HQ to OmniHub (`/api/omnibridge/sync`). |
| `OMNIHUB_SYNC_URL` | Full URL of the OmniHub sync endpoint that receives outbound telemetry from SBBL-HQ (e.g. `https://omnihub.example.com/api/omnibridge/sync`). |
| `OMNIHUB_VERIFY_KEY` | Inbound HMAC-SHA256 verification key — used to authenticate signed commands arriving at `POST /webhooks/omnihub`. Must match the signing key configured on the OmniHub side. |

> **Production recommendation:** Use separate key material for `OMNIHUB_VERIFY_KEY` (inbound) and `OMNIHUB_SIGNING_SECRET` (outbound). Sharing a single key couples the trust boundary between the two directions and complicates rotation.

### Testing locally with the integration validator

After populating `.dev.vars` with the three secrets above:

1. Start the dev worker: `npm run dev`
2. Run the integration validator: `npm run validate:omnibridge`
3. The validator sends a signed test command to `POST /webhooks/omnihub` and verifies:
   - HMAC signature accepted
   - Idempotency key recorded in `api_idempotency_keys`
   - Action dispatched and logged via `log_admin_action` RPC
   - Replay of the same command_id is rejected (dedup check)

If any check fails the validator exits non-zero with a descriptive error. Fix the secret values or local Supabase state before proceeding.

### Hard rules from CLAUDE.md §8

OmniBridge integration is governed by **CLAUDE.md §8** (OmniBridge hard rules). Before editing any OmniBridge handler, read that section in full. Key constraints:

- All inbound commands **must** pass HMAC-SHA256 signature verification against `OMNIHUB_VERIFY_KEY` before any action is taken.
- Commands classified as `BLOCKED` by the risk-lane classifier are **always rejected**, even if the HMAC is valid.
- Only the 9 actions on the allowlist may be dispatched; any command with an action outside the list is rejected with `400`.
- Clock-skew window is ±300 s — commands with a `timestamp` outside this window are rejected.
- Every accepted command is logged via `log_admin_action` regardless of outcome.

---

## New Dev Checklist

| Step | Done? |
|---|---|
| Clone repo and install dependencies (`npm install`) | ☐ |
| Copy and populate `.env` and `.dev.vars` (see Section 6) | ☐ |
| Run `npm run typecheck && npm run lint && npm run test && npm run build` — all green | ☐ |
| OmniBridge secrets configured in `.dev.vars` (`OMNIHUB_SIGNING_SECRET`, `OMNIHUB_SYNC_URL`, `OMNIHUB_VERIFY_KEY`) | ☐ |
| Run integration validator (`npm run validate:omnibridge`) — all checks pass | ☐ |
| Read CLAUDE.md §8 (OmniBridge hard rules) | ☐ |
