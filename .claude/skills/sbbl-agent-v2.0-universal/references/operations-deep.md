# SBBL HQ Operations Deep Reference
<!-- Version: v2.0.0 | Date: 2026-05-20 -->

## Infrastructure

```
Frontend + API:  Cloudflare Workers (sbbl-hq-worker)
Domain:          sbbl-hq.icu + www.sbbl-hq.icu (custom domains in wrangler.jsonc)
Database:        Self-hosted Supabase on AWS EC2
  ├── Primary:   EC2 instance (Supabase + PostgreSQL 15)
  ├── Standby:   Hot standby replica (WAL streaming)
  ├── Backup:    WAL archiving + EBS snapshots
  ├── TLS:       Caddy (auto-renew Let's Encrypt)
  └── Perimeter: Kong API gateway
Supabase URL:    https://supabase.sbbl-hq.icu
Monitoring:      Sentry + UptimeRobot
```

## Environment Variable System (Two Layers)

### Layer 1: Build-time (`.env` → Vite → client bundle)
```
VITE_APP_NAME=SBBL HQ
VITE_SUPABASE_URL=https://supabase.sbbl-hq.icu
VITE_SUPABASE_ANON_KEY=<anon key — NOT service role>
VITE_TURNSTILE_SITE_KEY=<Turnstile public key>
VITE_SENTRY_DSN=<Sentry frontend DSN>
VITE_DEFAULT_LEAGUE=SBBL
VITE_DEFAULT_PPV_PRICE=2.50
VITE_PUBLIC_BASE_URL=https://sbbl-hq.icu
VITE_APP_VERSION=<git SHA or semver>
SENTRY_AUTH_TOKEN=<for source map upload — never commit>
SENTRY_ORG=apex-business-systems
SENTRY_PROJECT=sbbl-hq-frontend
```

### Layer 2: Worker runtime (`.dev.vars` local, Wrangler secrets production)
```
SUPABASE_SERVICE_ROLE_KEY   ← Supabase service role (NEVER commit)
STRIPE_SECRET_KEY           ← Stripe live/test secret key
STRIPE_WEBHOOK_SECRET       ← Stripe webhook signing secret
RESEND_API_KEY              ← Resend email API key
GROQ_API_KEY                ← Groq Vision API (POTG image parser)
SENTRY_DSN_WORKER           ← Worker Sentry DSN
OMNIHUB_SIGNING_SECRET      ← HMAC for outbound sync (also inbound fallback)
OMNIHUB_SYNC_URL            ← OmniHub sync endpoint URL
OMNIHUB_VERIFY_KEY          ← HMAC for inbound verification (production only)
```

**VITE_SUPABASE_PUBLISHABLE_KEY** — deprecated alias. Use `VITE_SUPABASE_ANON_KEY`.

## Deployment

```bash
# Local development
npm run dev            # Vite dev server (port 5173)
bun x wrangler dev     # Worker local (port 8787)

# Deploy to production
npm run cf:deploy      # wrangler deploy → sbbl-hq-worker → sbbl-hq.icu

# Mobile builds (codemagic.yaml)
# iOS: Capacitor → Xcode → codemagic → App Store
# Android: Capacitor → Gradle → codemagic → Play Store
```

**CRITICAL:** Worker name `sbbl-hq-worker` is FROZEN.
`.github/workflows/block-cf-rename-pr.yml` blocks any PR that renames it.
Renaming deploys to a different worker, breaking custom domains + all secrets.

## CI/CD Pipeline (13 GitHub Actions Workflows)

| Workflow | Trigger | Gates |
|----------|---------|-------|
| `ci.yml` | Push/PR to main | lint → typecheck → test → build |
| `deploy.yml` | Merge to main | Post-CI deploy to CF Workers |
| `playwright-e2e.yml` | PR | Playwright E2E smoke suite |
| `stream-contract-gate.yml` | PR (migration diff) | pglast AST: blocks game_id NOT NULL |
| `broadcast-test-gate.yml` | PR | Broadcast paywall regression suite |
| `build-chaos-battery.yml` | PR | Chaos + stress tests |
| `ops-harmony-gate.yml` | PR | Ops panel integration tests |
| `selfhost-auth-smoke.yml` | PR | Self-hosted Supabase auth smoke |
| `block-cf-rename-pr.yml` | PR | Blocks worker rename |
| `broadcast-evidence.yml` | PR | Evidence artifact collection |
| `supabase-config-hibp-hotfix.yml` | PR | HIBP config validation |

## Validation Gates (all required before merge)

```bash
npm run typecheck   # strict TS — app + node configs
npm run lint        # ESLint --max-warnings 0
npm test            # Vitest (≥80% coverage, 100% new code)
npm run build       # Vite production build
```

## Migration Protocol

```
1. Create: supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
2. NEVER edit existing migrations (they're immutable once merged)
3. For rollbacks: create a new migration that reverts
4. Test locally: supabase db push (local) → review plan
5. Production: applied automatically on next deploy
```

## SLAs

| Metric | Target |
|--------|--------|
| Score → standings propagation | <5s |
| Registration confirmation | <2s |
| LCP (Largest Contentful Paint) | <1.8s |
| Uptime | 99.9% |
| Stream entitlement check | <200ms |
| Broadcast oracle response | <150ms |

## Season Ops Cycle

**Pre-Season:**
1. Create League → Season → Divisions in Supabase
2. Team registration → player signup → coach approval
3. Schedule builder → schedule_slots populated
4. Stripe products configured (registration fees, PPV pricing)

**In-Season:**
1. Game day: admin sets is_live=true → admin_sync_broadcast_to_sessions()
2. Live scoring: SCOREKEEPER enters player_game_stats
3. stat_line_submissions: draft → finalize_game_stats() → player_game_stats
4. mvw_standings refreshed CONCURRENTLY by trigger on game.status → 'final'
5. AI weekly digest: GROQ → ai_weekly_digest (UNIQUE league_id + week_start)
6. Replay: embargo 1–2 weeks → replay_entitlements ($1.50/game)

**Post-Season:**
1. Playoffs bracket → games with elimination logic
2. POTG awards → player_game_stats, GROQ image parser (headshots)
3. Hall of Fame data → archive season
4. Media publications → pin highlights before archiving

## Supabase Auth Configuration

- PKCE flow enabled (verified by `src/test/supabase-client-pkce.test.ts`)
- Google OAuth: configured, `?intent=fan` must survive OAuth round-trip
- Captcha: Cloudflare Turnstile (invisible mode, execute-on-demand)
- HIBP (HaveIBeenPwned) integration configured

## Monitoring & Alerting

**Sentry:**
- Frontend: `@sentry/react` initialized in `src/instrument.ts` (first import in main.tsx)
- Worker: `@sentry/cloudflare` wrapper with 5% trace sampling
- `AppErrorBoundary` captures unhandled React errors
- `AuthContext` tags Sentry scope with user identity
- Alert: `stream.access.v2` error rate > 0.1%

**UptimeRobot:** Pings key endpoints on interval

## Performance: 10K+ Concurrent User Architecture

- **DB indexes:** 30+ on hot-path tables (see cto-deep.md)
- **Edge caching:** `Cache-Control: public, s-maxage=30` on public endpoints
- **react-window v2:** Virtualizes 50+ row lists (Stats, Leaderboards)
- **Vite chunks:** Manual split (react, supabase, ui, media, utils, query vendor)
- **Cloudflare edge:** Worker processes all requests at edge globally
- **Heartbeat batch upsert:** `heartbeat_batch_upsert()` RPC (migration 20260406000100)
- **Rate limiter:** V8 isolate rate limiter (no memory leak)
- **Turnstile:** Invisible CAPTCHA on auth to prevent bot storms

## Capacitor Mobile Build

```
capacitor.config.ts  ← app bundle config
codemagic.yaml       ← CI/CD for iOS + Android
appstore/            ← submission checklist + metadata
```

iOS: Xcode build → TestFlight → App Store
Android: Gradle build → Play Store

## PWA Offline Configuration

```
Service worker: VitePWA + Workbox
navigateFallback: '/offline'
denylist: /api/*, /auth/*, /webhooks/*
Offline page: src/pages/Offline.tsx (links to cached routes)
OfflineBanner: src/components/OfflineBanner.tsx (shows when navigator.onLine = false)
```
