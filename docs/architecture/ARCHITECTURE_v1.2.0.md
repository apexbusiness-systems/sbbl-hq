<!-- Version: v1.2.0 | Date: 2026-04-04 | Status: Current -->
# SBBL HQ Architecture

**Version:** v1.2.0
**Last Updated:** 2026-04-04

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript (strict) |
| Styling | Tailwind CSS — dark-first, gold accent |
| Database | Supabase (PostgreSQL 15 + Realtime + Auth + Storage) |
| Hosting | **Cloudflare Workers** (FE static assets + API Worker) |
| Payments | Stripe (Checkout + webhooks via Supabase Edge Function) |
| Animation | Framer Motion |
| Virtualization | react-window v2 — Stats and Leaderboards lists (50+ rows) |
| PWA | VitePWA (Workbox) — service worker with offline fallback |
| Captcha | Cloudflare Turnstile (invisible, execute-on-demand) |
| Testing | Vitest + istanbul coverage + Playwright E2E |
| CI/CD | GitHub Actions — lint, typecheck, test+coverage, build+bundle guard, Lighthouse LCP |
| Errors | Sentry (@sentry/react + @sentry/cloudflare) |
| Uptime | UptimeRobot |

> **Hosting is Cloudflare Workers — NOT Vercel.** Do not suggest or configure Vercel. Do not add `vercel.json`. The deployment target is `wrangler.jsonc` → `npm run cf:deploy`.

---

## Request Flow

```
Browser → Cloudflare Edge
  ├── /api/*, /auth/*, /webhooks/*, /ops/*  → Worker (src/worker/index.ts)
  └── Everything else                       → Static assets (dist/)
```

The Worker handles all API routes. Static assets are served from the `dist/` folder built by Vite. The worker name in `wrangler.jsonc` is `sbbl-hq-worker`.

---

## Frontend Architecture

### Context Providers

| Provider | File | Responsibility |
|---|---|---|
| `AppContext` | `src/contexts/AppContext.tsx` | League selection, stats, UI state |
| `AuthContext` | `src/contexts/AuthContext.tsx` | Supabase auth session, role enrichment, Sentry user tagging |
| `BagContext` | `src/contexts/BagContext.tsx` | Shopping bag state (addToBag, removeFromBag, bagOpen). Extracted from AppContext to prevent bag mutations from re-rendering unrelated consumers. |

### Key Hooks

| Hook | File | Purpose |
|---|---|---|
| `useTurnstile` | `src/hooks/use-turnstile.ts` | Manages Cloudflare Turnstile widget lifecycle. Singleton script loader, invisible execute-on-demand mode. Returns `{ containerRef, resolveToken, ready }`. Used by Login and LiveStreamPlayer. |

### Performance Optimizations

- **react-window v2** virtualizes Stats and Leaderboards player lists when row count exceeds threshold (50+ rows). Row components are plain functions (not memo-wrapped) — react-window handles memoization internally.
- **Vite manual chunks** (`vite.config.ts`) split the bundle into long-lived vendor chunks: `react-vendor`, `supabase-vendor`, `ui-vendor`, `media-vendor`, `utils-vendor`, `query-vendor`. Tree-shaken chunks (`charts-vendor`, `rxdb-vendor`, `forms-vendor`) are excluded from bundle guard checks.

### Offline Mode

- **Service worker** configured via VitePWA with `navigateFallback: '/offline'` and denylist for `/api`, `/auth`, `/webhooks` routes.
- **Offline page** (`src/pages/Offline.tsx`) — fallback UI with links to cached routes (Schedule, Scores, Leaderboards).
- **OfflineBanner** (`src/components/OfflineBanner.tsx`) — displays when `navigator.onLine === false`, indicating cached data is being shown.

### Error Monitoring (Sentry)

- `src/instrument.ts` initializes `@sentry/react` before any React rendering (imported first in `main.tsx`).
- `AppErrorBoundary` captures unhandled React errors to Sentry.
- `AuthContext` tags Sentry scope with user identity on auth state changes.
- Worker uses `@sentry/cloudflare` wrapper with 5% trace sampling.
- Vite plugin uploads source maps to Sentry on production builds (when `SENTRY_AUTH_TOKEN` is set).
- `SENTRY_DSN` is configured in `wrangler.jsonc` vars for the worker.

---

## ENV VAR SYSTEM — TWO SEPARATE LAYERS

This is the #1 source of agent mistakes. There are two completely separate env systems.

### Layer 1: Build-time (Vite)

Baked into the browser bundle at `npm run build`. The Supabase **client** (browser-side) reads these.

| Variable | Canonical Name | Notes |
|---|---|---|
| Supabase URL | `VITE_SUPABASE_URL` | Set in `.env` + GitHub Secret |
| Supabase anon key | `VITE_SUPABASE_ANON_KEY` | Set in `.env` + GitHub Secret. **This is the `eyJ...` anon JWT from Supabase dashboard.** |
| Turnstile site key | `VITE_TURNSTILE_SITE_KEY` | Optional. When absent, captcha is skipped (safe for dev). |
| Sentry DSN | `VITE_SENTRY_DSN` | Optional. Enables client-side error tracking. |

**`VITE_SUPABASE_PUBLISHABLE_KEY` is a deprecated alias in `runtime-config.ts`. Never set it as primary. Always use `VITE_SUPABASE_ANON_KEY`.**

### Layer 2: Worker runtime (Cloudflare)

Read from `wrangler.jsonc` vars block or `wrangler secret put`. The Cloudflare **Worker** reads these — they never reach the browser.

| Variable | How to set |
|---|---|
| `SUPABASE_URL` | `wrangler.jsonc` vars (already set) |
| `SUPABASE_PUBLISHABLE_KEY` | `wrangler.jsonc` vars (already set) |
| `SENTRY_DSN` | `wrangler.jsonc` vars (already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put` |
| `STRIPE_SECRET_KEY` | `wrangler secret put` |
| `STRIPE_WEBHOOK_SECRET` | `wrangler secret put` |
| `OPTIONAL_TURNSTILE_SECRET_KEY` | `wrangler secret put` |
| `RESEND_API_KEY` | `wrangler secret put` |

### Why `/api/public-config` does NOT return Supabase keys

The `/api/public-config` worker endpoint intentionally returns only `appName` and `defaultLeague`. The Supabase client initializes from the **Vite build bundle**, not from a runtime API call. This is intentional. Do not add keys to that endpoint.

---

## Data Model

```
League → Season → Division → Team → Player → Game → GameStat → Standings (mvw_standings)
```

- **League:** `id, name, type (WBL|TGIF|SPRING), active`
- **Season:** `id, league_id, start_date, end_date, status`
- **Team:** `id, league_id, name, logo_url, captain_id`
- **Player:** `id, team_id, user_id, name, jersey_no, position, avatar_url`
- **Game:** `id, home_id, away_id, scheduled_at, venue, status, home_score, away_score`
- **GameStat:** `id, game_id, player_id, pts, reb, ast, stl, blk, fgm, fga, fta, ftm, minutes, turnovers`
- **Standings:** `mvw_standings` materialized view — wins, losses, pts_for, pts_against, win_pct. Auto-refreshed CONCURRENTLY on game finalization.

---

## Access Control

| Role | Permissions |
|---|---|
| `super_admin` | Full CRUD all — stream config, access override |
| `league_admin` | League-scoped CRUD — ops read/write own league |
| `team_manager` / `coach` | Team-scoped ops read, scoped write |
| `player` | Read all, edit own profile, free stream access |
| `paid_fan` | Free stream access, can generate PPV invites |
| `fan` | Read-only, PPV purchase required for streams |

**RLS Iron Law:** Every table must have RLS enabled. No exceptions. The `trg_auto_enable_rls` DDL event trigger enforces this automatically on table creation and logs to `rls_audit`.

---

## CI/CD Pipeline

```
PR → Lint & Typecheck → Unit & Integration Tests (coverage) → Build & Bundle Check → Playwright E2E
                                                                        ↓
                                                              Supabase Preview (migrations)
                                                              Cloudflare Workers Builds
```

- **Coverage thresholds** (vitest.config.ts): lines 25%, functions 20%, branches 14%, statements 23% — scoped to 6 critical files.
- **Bundle guard** (ci.yml): enforces KB limits per vendor chunk with `|| true` guard for tree-shaken chunks under `set -eo pipefail`.
- **Supabase Preview:** creates a database branch and applies all migrations. Defensive patterns (exception handlers) ensure preview compatibility.
