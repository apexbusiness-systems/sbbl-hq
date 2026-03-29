# SBBL HQ — Release Cut Report

**Date:** 2026-03-29
**Version:** 1.0.0-rc.1
**Branch:** `claude/prepare-annotated-skills-GYFNR`

---

## Executive Summary

Investor-grade release cut converting SBBL HQ from a mock-data prototype to a production-ready basketball super app backed by real Supabase APIs via Cloudflare Workers.

---

## Root Causes Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Mock data in investor-facing routes | Components imported from `@/data/mock` | Created public read model API + canonical league model |
| Auth boot crash without env vars | `createClient()` called at module scope with undefined URL | Runtime config fetch from `/api/public-config` with `import.meta.env` fallback |
| Hardcoded Supabase credentials in HTML | Build-time env vars baked into client bundle | Worker-served runtime config; no raw env var names exposed |
| Music autoplay on page load | `audio.play()` called in `useEffect` without user gesture | Removed autoplay; playback requires user click |
| Inconsistent brand tokens | Mixed font families and approximate HSL values | Exact hex-to-HSL conversion; Bebas Neue replaces Space Grotesk |
| Scattered league definitions | League data duplicated across components | Single `LEAGUE_CONFIGS` source of truth in `src/lib/leagues.ts` |

---

## Architecture Changes

### Runtime Config Bootstrap

```
Browser boot → fetch /api/public-config → cache → init Supabase client
                  ↓ (failure)
              import.meta.env fallback (local dev)
```

**Files:** `src/lib/runtime-config.ts`, `src/lib/supabase/client.ts`, `src/contexts/AuthContext.tsx`

### Public Read Model API

Worker endpoint `/api/public/home?league=sbbl` aggregates:
- `teams` (with roster counts)
- `games` (live, upcoming, recent)
- `seasons`, `leagues`

Returns shaped DTOs — no raw Supabase schema exposed to client.

**Files:** `src/worker/index.ts` (handlers), `src/lib/api/public.ts` (client types + fetch)

### Canonical League Model

Single source: `src/lib/leagues.ts`
- `LEAGUE_CONFIGS[]` — id, code, name, tagline, color
- Helpers: `getLeagueConfig()`, `leagueIdFromCode()`, `persistLeague()`
- Consumed by: `AppContext`, `Header`, `LeagueBadge`, `Home`, `Login`

---

## Routes — Release Cut Scope

### Backed by Real Data (Shipped)

| Route | Data Source |
|-------|------------|
| `/` (Home) | `/api/public/home` → Supabase |
| `/login` | Supabase Auth (magic link) |
| `/onboarding` | Supabase Auth + profiles |
| `/teams` | Supabase teams table |
| `/billing` | Supabase + Stripe (RequireAuth) |
| `/settings` | Supabase profiles (RequireAuth) |
| `/ops/*` | Supabase admin tables (RequireAdmin) |

### Deferred (Removed from Nav)

| Route | Reason |
|-------|--------|
| `/live` | Depends on real-time game streaming |
| `/schedules` | Needs season schedule data pipeline |
| `/store` | Mock product catalog |
| `/profiles/:id` | Needs public player profiles API |
| `/stats` | Needs aggregated stats pipeline |
| `/leaderboards` | Needs computed leaderboard data |
| `/media` | Mock media content |

---

## Brand & Shell Changes

| Token | Before | After |
|-------|--------|-------|
| Display font | Space Grotesk | Bebas Neue |
| `--primary` | `40 60% 55%` | `43 52% 54%` (#C9A84C) |
| `--foreground` | `40 10% 92%` | `60 14% 95%` (#F5F5F0) |
| `--card` | `0 0% 7%` | `0 0% 6.7%` (#111111) |
| `--muted-foreground` | `0 0% 50%` | `0 0% 54%` (#8A8A8A) |
| `--destructive` | `0 72% 50%` | `355 76% 56%` (#E63946) |
| `--success` | `145 60% 42%` | `138 62% 48%` (#2DC653) |

- Gold gradient: `hsl(43 52% 54%)` → `hsl(42 73% 66%)`
- Headings: `font-family: 'Bebas Neue'` + `uppercase` + `tracking-wide`
- StickyMusicPlayer: retained, autoplay removed

---

## Test Evidence

### Unit & Integration (Vitest)

| Suite | Tests | Status |
|-------|-------|--------|
| runtime-config | 2 | ✅ |
| leagues | 5 | ✅ |
| login-page | 4 | ✅ |
| home-hero-fallback | 2 | ✅ |
| worker-routes | 3 | ✅ |
| worker-stripe-webhook | 3 | ✅ |
| worker-ingress | 1 | ✅ |
| worker-ops-imports | 1 | ✅ |
| teams-page | 1 | ✅ |
| stats-validator | 2 | ✅ |
| omniport | 3 | ✅ |
| idempotency | 2 | ✅ |
| migration-smoke | 1 | ✅ |
| subscription | 3 | ✅ |
| roles | 2 | ✅ |
| example | 1 | ✅ |
| **Total** | **36** | **All passing** |

### Quality Gates

- **Lint:** 0 errors, 0 warnings
- **Typecheck:** Clean (tsconfig.app.json + tsconfig.node.json)
- **Build:** Successful (Vite production)

### E2E (Playwright)

8 critical-path specs written in `e2e/critical-paths.spec.ts`:
1. Home page renders
2. League selector visible
3. League switch
4. Login — no raw config errors
5. Login — trust bullets
6. Teams nav
7. Nav only shows release-cut routes
8. No autoplay audio / Mobile login layout

---

## Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `/api/public-config` latency on cold start | Medium | Fallback to `import.meta.env` covers local dev; Worker cold starts typically <100ms |
| Supabase RLS must be configured for public reads | High | Worker uses service role key; public endpoint returns only shaped DTOs |
| No real game data yet | Low | Home shows "Season Coming Soon" empty state gracefully |
| Playwright E2E needs Playwright installed in CI | Low | CI pipeline includes `playwright install --with-deps` step |

---

## Files Changed

### New Files
- `src/lib/runtime-config.ts` — Runtime config bootstrap
- `src/lib/leagues.ts` — Canonical league model
- `src/lib/api/public.ts` — Public API client
- `src/test/runtime-config.test.ts`
- `src/test/leagues.test.ts`
- `src/test/login-page.test.tsx`
- `e2e/critical-paths.spec.ts`
- `.github/workflows/ci.yml`

### Modified Files
- `src/worker/index.ts` — Public config + home handlers
- `src/lib/supabase/client.ts` — Async init
- `src/contexts/AuthContext.tsx` — Runtime config boot
- `src/contexts/AppContext.tsx` — Canonical league model
- `src/pages/Home.tsx` — Full rewrite, real API
- `src/pages/Login.tsx` — Full rewrite, branded
- `src/pages/Billing.tsx` — Mock data removed
- `src/App.tsx` — Release-cut routes
- `src/components/layout/Header.tsx` — Reduced nav
- `src/components/layout/BagDrawer.tsx` — Mock removed
- `src/components/ui/LeagueBadge.tsx` — Canonical leagues
- `src/components/marketing/StickyMusicPlayer.tsx` — No autoplay
- `src/index.css` — Brand tokens
- `tailwind.config.ts` — Bebas Neue font
- `src/test/home-hero-fallback.test.tsx` — Rewritten
- `src/test/worker-routes.test.ts` — Rewritten
