<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# SBBL HQ Architecture

**Version:** v1.0.1
**Last Updated (UTC):** 2026-03-29

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript (strict) |
| Styling | Tailwind CSS — dark-first, gold accent |
| Database | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| Hosting | **Cloudflare Workers** (FE static assets + API Worker) |
| Payments | Stripe (checkout + webhooks) |
| Animation | Framer Motion |
| Testing | Vitest + Playwright |
| CI/CD | GitHub Actions |
| Errors | Sentry |
| Uptime | UptimeRobot |

> **Hosting is Cloudflare Workers — NOT Vercel.** Do not suggest or configure Vercel. Do not add `vercel.json`. The deployment target is `wrangler.jsonc` → `npm run cf:deploy`.

---

## Request Flow

```
Browser → Cloudflare Edge
  ├── /api/*, /auth/*, /webhooks/*, /ops/*  → Worker (src/worker/index.ts)
  └── Everything else                       → Static assets (dist/)
```

The Worker handles all API routes. Static assets are served from the `dist/` folder built by Vite.

---

## ⚠️ ENV VAR SYSTEM — TWO SEPARATE LAYERS

This is the #1 source of agent mistakes. There are two completely separate env systems.

### Layer 1: Build-time (Vite)

Baked into the browser bundle at `npm run build`. The Supabase **client** (browser-side) reads these.

| Variable | Canonical Name | Notes |
|---|---|---|
| Supabase URL | `VITE_SUPABASE_URL` | Set in `.env` + GitHub Secret |
| Supabase anon key | `VITE_SUPABASE_ANON_KEY` | Set in `.env` + GitHub Secret. **This is the `eyJ...` anon JWT from Supabase dashboard.** |

**`VITE_SUPABASE_PUBLISHABLE_KEY` is a deprecated alias in `runtime-config.ts`. Never set it as primary. Always use `VITE_SUPABASE_ANON_KEY`.**

If these are absent at build time → `configAvailable = false` → app shows auth error banner.

### Layer 2: Worker runtime (Cloudflare)

Read from `wrangler.jsonc` vars block or `wrangler secret put`. The Cloudflare **Worker** reads these — they never reach the browser.

| Variable | How to set |
|---|---|
| `SUPABASE_URL` | `wrangler.jsonc` vars (already set) |
| `SUPABASE_PUBLISHABLE_KEY` | `wrangler.jsonc` vars (already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put` |
| `STRIPE_SECRET_KEY` | `wrangler secret put` |
| `STRIPE_WEBHOOK_SECRET` | `wrangler secret put` |
| `RESEND_API_KEY` | `wrangler secret put` |

### Why `/api/public-config` does NOT return Supabase keys

The `/api/public-config` worker endpoint intentionally returns only `appName` and `defaultLeague`. The Supabase client initializes from the **Vite build bundle**, not from a runtime API call. This is intentional. Do not add keys to that endpoint.

---

## Data Model

```
League → Season → Division → Team → Player → Game → GameStat → Standings
```

- **League:** `id, name, type (WBL|TGIF|SPRING), active`
- **Season:** `id, league_id, start_date, end_date, status`
- **Team:** `id, league_id, name, logo_url, captain_id`
- **Player:** `id, team_id, user_id, name, jersey_no, position, avatar_url`
- **Game:** `id, home_id, away_id, scheduled_at, venue, status, home_score, away_score`
- **GameStat:** `id, game_id, player_id, pts, reb, ast, stl, blk, fgm, fga, fta, ftm, minutes, turnovers`
- **Standings:** computed view — wins, losses, pts_for, pts_against, streak, net_rating

---

## Access Control

| Role | Permissions |
|---|---|
| ADMIN | Full CRUD all |
| COMMISSIONER | League-scoped CRUD |
| SCOREKEEPER | Stat entry on assigned games |
| PLAYER | Read all, edit own profile |
| PUBLIC | Read-only |

**RLS Iron Law:** Every table must have RLS enabled. No exceptions. Never defer.

---

## public-config Endpoint

`GET /api/public-config` returns:
```json
{ "ok": true, "appName": "SBBL HQ", "defaultLeague": "SBBL" }
```

It does **not** return Supabase keys. By design. Do not change this.
