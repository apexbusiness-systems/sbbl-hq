# SBBL-HQ Agent & Developer Onboarding Guide

**Version:** 2.1.0  
**Last Updated:** 2026-05-13  
**Verified Against:** Full repo audit — `package.json`, `CLAUDE.md`, `wrangler.jsonc`, `ci.yml`, `deploy.yml`, `src/worker/bindings.d.ts`, `vitest.config.ts`  
**Maintained By:** APEX Business Systems Ltd.

> [!IMPORTANT]
> Read this document in full before making ANY change to this repository.
> Every fact stated here is verified against actual source files.
> Do NOT act on agent memory, hallucinated paths, or undocumented assumptions.

---

## 1. What Is SBBL-HQ?

SBBL-HQ is a **basketball super-app** serving three leagues:

| League | Format |
|--------|--------|
| WBL (Weekend Basketball League) | Competitive 5v5 |
| TGIF League | Recreational |
| SBBL Spring Edition | Tournament bracket |

**Live URL:** https://sbbl-hq.icu  
**Supabase Project ID:** `ezanilxygnpucwkwpsoc`  
**Cloudflare Worker Name:** `sbbl-hq-worker` (CRITICAL: do NOT rename — see `wrangler.jsonc`)

---

## 2. Verified Tech Stack

These are the actual packages in `package.json` v1.3.0:

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | React 18.3, Vite 5.4, TS 5.8 |
| UI | Radix UI + Tailwind CSS + shadcn/ui | Tailwind 3.4 |
| Routing | react-router-dom | 6.30 |
| State/Data | @tanstack/react-query | 5.83 |
| Backend | Cloudflare Worker (`src/worker/index.ts`) | wrangler 4.8 |
| Database | Supabase (PostgreSQL + RLS) | @supabase/supabase-js 2.57 |
| Auth | Supabase Auth + JWT (`jose` 6.2) | Server-verified only |
| Payments | Stripe | stripe in worker |
| Monitoring | Sentry (Cloudflare + React) | @sentry 10.47 |
| Testing | Vitest 3.2 + Playwright 1.57 | jsdom environment |
| Mobile | Capacitor 8.3 | iOS + Android |

---

## 3. Repo Structure (Verified)

```
sbbl-hq/
├── src/
│   ├── pages/          ← Page components; fetch via useQuery only
│   ├── components/     ← Shared UI; NEVER fetch data directly
│   │   ├── OpsMediaLibrary/ ← Media Intelligence: cards, search, bulk, DnD, stale cleanup, Sheets
│   ├── hooks/          ← React hooks
│   │   ├── useMedia*.ts         ← Media search, bulk, pin, drag, stale cleanup, upload
│   ├── contexts/       ← App/Auth/Bag context providers
│   ├── lib/
│   │   ├── api/        ← API client wrappers (public.ts, stream.ts, etc.)
│   │   ├── stream/     ← url-detector.ts, streamforge.ts
│   │   ├── leagues.ts  ← LEAGUE_REGISTRY (canonical branding source)
│   │   └── constants/  ← ENTITLEMENT_CONSTANTS, etc.
│   │   └── media/          ← mediaParserSchema.ts (shared parser Zod schema)
│   ├── worker/
│   │   ├── index.ts          ← Main CF Worker (279KB — all core routes)
│   │   ├── routes/           ← Route handlers (12 files)
│   │   │   ├── public.ts
│   │   │   ├── engagement.ts
│   │   │   ├── highlights.ts
│   │   │   ├── overlay.ts
│   │   │   ├── overlay-events.ts
│   │   │   ├── tokens.ts
│   │   │   ├── biometrics.ts
│   │   │   ├── sponsors.ts
│   │   │   ├── obs.ts
│   │   │   ├── digest.ts
│   │   │   ├── replay.ts
│   │   │   └── stream-qoe.ts
│   │   ├── bindings.d.ts     ← Env interface (all worker secrets)
│   │   ├── stripe-utils.ts   ← Stripe HMAC helpers
│   │   ├── shared.ts         ← Shared worker types
│   │   └── validation-contract-wrapper.ts  ← CF Worker entrypoint
│   ├── test/           ← 94 test files (vitest)
│   ├── types/          ← TypeScript types (database.generated.ts)
│   └── data/           ← TEST FIXTURES ONLY — NEVER import in prod
├── supabase/
│   ├── migrations/     ← 66+ migration files (immutable once merged)
│   │                     20260513 — Media Intelligence Overhaul (bulk archive/restore, stale cleanup, pin, parser confidence)
│   ├── functions/      ← Edge functions
│   └── config.toml     ← Supabase local config
├── e2e/                ← Playwright E2E tests
├── ops/
│   ├── runbooks/       ← Operational runbooks
│   ├── validation/     ← stream-validation.mjs
│   ├── audits/
│   └── cloudflare/
├── docs/               ← All documentation (you are here)
├── .agents/            ← Agent skill files
├── .claude/            ← Claude skill files + commands
├── .github/
│   └── workflows/      ← 16 CI/CD workflow files
├── package.json        ← v1.3.0 — single source of truth for scripts
├── vitest.config.ts    ← jsdom env, setupFiles: src/test/setup.ts
├── playwright.config.ts
├── wrangler.jsonc      ← CF Worker config (prod)
└── wrangler.deploy.jsonc ← CF Worker config (deploy pipeline)
```

---

## 4. Non-Negotiable Hard Rules

These rules are enforced by CI and must never be violated:

### Rule 1: No Mock Data in Production
**NEVER** import from `src/data/mock.ts`, `src/data/schedules.ts`, or `src/data/teams.ts` in:
- `src/pages/**`
- `src/components/**`
- `src/hooks/**`
- `src/contexts/**`
- `src/worker/**`
- `src/lib/**`

**Enforcement:** ESLint `no-restricted-imports` + `src/test/no-mock-in-production.test.ts`  
**Use instead:** `/api/public/*` worker endpoints

### Rule 2: No `|| mockX` Fallbacks
```ts
// ❌ BANNED
const players = apiData?.length ? apiData : mockPlayers;

// ✅ CORRECT
const players = Array.isArray(apiData) ? apiData : [];
```

### Rule 3: Stream Independence Contract
Streams are NOT games. `game_id` on stream tables is nullable legacy.  
- **NEVER** `ALTER TABLE streams ADD COLUMN game_id uuid NOT NULL`  
- **NEVER** read `game.stream_url` from worker or frontend  
- **Always** resolve via `stream_assignments → streams`  
- **Reference:** `docs/architecture/STREAM_INDEPENDENCE_CONTRACT.md`

### Rule 4: Server-Authoritative Auth
Session identity is established ONLY via Supabase JWT verified in `getSession()`.  
Client-supplied identity headers are IGNORED.  
`x-sbbl-user-id-verified` is set internally by the worker after JWT verification.

### Rule 5: Migrations Are Immutable
Once a migration is merged to `main`, it is NEVER edited.  
Always create a NEW dated migration file.  
Format: `YYYYMMDDHHMMSS_description.sql`

### Rule 6: Worker Name Is Sacred
The CF Worker is named `sbbl-hq-worker` (from `wrangler.jsonc`).  
Custom domains `sbbl-hq.icu` and `www.sbbl-hq.icu` are bound to this exact name.  
Renaming without migrating domains AND secrets breaks the live site.

---

## 5. Validation Gates — All Must Pass Before Merge

These are the EXACT commands from `ci.yml`:

```bash
# Gate 1: Lint (zero-warning policy)
npx eslint . --max-warnings 0

# Gate 2: Typecheck (app)
npx tsc --noEmit -p tsconfig.app.json

# Gate 3: Typecheck (node config) — continue-on-error in CI
npx tsc --noEmit -p tsconfig.node.json

# Gate 4: Tests + Coverage
npx vitest run --coverage --reporter=dot --max-workers=2

# Gate 5: Build
npm run build

# Gate 6: Playwright E2E (requires build artifacts)
npx playwright test
```

**Local shortcut:**
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

**Test environment:** jsdom, setup file at `src/test/setup.ts`  
**Test glob:** `src/**/*.{test,spec}.{ts,tsx}`

---

## 6. Worker Environment — Verified Bindings

From `src/worker/bindings.d.ts`:

| Binding | Required | Purpose |
|---------|---------|---------|
| `SUPABASE_URL` | ✅ | DB + Auth URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Admin DB access |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | Anon key |
| `STRIPE_SECRET_KEY` | ✅ | Payments |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook verification |
| `RESEND_API_KEY` | ✅ | Email |
| `SENTRY_DSN` | Optional | Error monitoring |
| `GROQ_API_KEY` | Optional | POTG image parser |
| `OMNIHUB_SYNC_URL` | Optional | OmniHub integration |
| `OMNIHUB_SIGNING_SECRET` | Optional | OmniHub HMAC |
| `OMNIHUB_VERIFY_KEY` | Optional | OmniHub verify |
| `OPTIONAL_TURNSTILE_SECRET_KEY` | Optional | Bot protection |
| `ENABLE_STREAM_VALIDATION` | Optional | Feature flag |
| `VITE_STREAM_URL` | Optional | Fallback stream URL |
| `OBS_AGENT_TOKEN` | Optional | OBS agent auth |
| `PLAYBACK_TOKEN_SECRET` | Optional | Native HLS signing |
| `FEATURE_SIGNED_PLAYBACK_ENABLED` | Optional | WS2 flag |
| `FEATURE_NATIVE_HLS_PROVIDER` | Optional | WS2 flag |
| `FEATURE_SHOW_VIEWER_PREFLIGHT` | Optional | WS3 flag |
| `FEATURE_FAN_TOKEN_SYSTEM` | Optional | WS4 flag |
| `FEATURE_BIOMETRIC_OVERLAY` | Optional | WS5 flag |
| `FEATURE_MIC_UP_SERIES` | Optional | WS6 flag |
| `ASSETS` | ✅ | CF static assets binding |

**Set secrets with:** `npx wrangler secret put <KEY_NAME>`  
**NEVER** commit secrets to source files.

---

## 7. CI/CD Pipeline (Verified from `.github/workflows/`)

### Main CI (`ci.yml`) — Triggers on push/PR to `main`, `staging`, `release/**`

| Job | Depends On | Timeout | What It Does |
|-----|-----------|---------|-------------|
| `lint` | — | 10m | ESLint zero-warning + tsc typecheck |
| `test` | — | 20m | vitest + coverage (parallel with lint) |
| `build` | `lint` | 15m | vite build + bundle size guards |
| `lighthouse` | `build` | 15m | LCP < 1800ms budget |
| `e2e` | `build` | 20m | Playwright chromium + webkit |

### Deploy (`deploy.yml`) — Triggers on push to `main` or manual dispatch

1. Build frontend (vite)
2. Run `python update_livestream.py` (pre-live evidence)
3. Deploy to Cloudflare Workers (`wrangler deploy --config wrangler.deploy.jsonc`)
4. Push runtime secrets via `wrangler versions secret put`
5. Health gate: probe `https://sbbl-hq.icu/ops/health` (8 attempts, 15s apart)

**Required GitHub Secrets for Deploy:**
- `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_API_TOKEN_WORKERS`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (required — deploy fails without it)
- Stripe, Resend, Sentry, OmniHub, Groq (optional)

---

## 8. Database (Supabase)

**Project:** `ezanilxygnpucwkwpsoc`  
**URL:** `https://ezanilxygnpucwkwpsoc.supabase.co`

### Migration Rules
1. Files in `supabase/migrations/` are IMMUTABLE once merged
2. Always create a NEW file for any schema change
3. Push with: `npm run db:migrate` (runs `supabase db push`)
4. Regenerate types after schema changes: `npm run db:types`

### Migration History (65 files, 2026-03-27 to 2026-04-19)
Key milestones:
- `202603270001` — Core schema (players, teams, games, leagues, seasons)
- `20260402000100` — `stream_admin_config` table added
- `20260407200000` — Ingest pipeline schema
- `20260417140000` — Broadcast integration
- `20260418000100` — Biometric + Mic Up
- `20260418120000` — Playback provider abstraction
- `20260419101500` — Fan token system
- `20260419130000` — Replay entitlements

### RLS Iron Law
Every table must have RLS enabled. No exceptions.  
CI gate (`armageddon-stream-invariants.test.ts`) enforces this.

---

## 9. Available npm Scripts (Verified from `package.json`)

```bash
# Development
npm run dev                    # Vite dev server

# Quality Gates
npm run typecheck              # tsc --noEmit (app + node)
npm run lint                   # eslint . 
npm test                       # vitest run
npm run test:watch             # vitest (watch mode)

# Build
npm run build                  # Production build
npm run build:dev              # Dev build

# Deploy
npm run cf:deploy              # wrangler deploy (prod)
npm run cf:deploy:staging      # wrangler deploy --env staging

# Database
npm run db:migrate             # supabase db push
npm run db:types               # Generate TypeScript types

# Stream Validation
npm run test:stream:unit       # node ops/validation/stream-validation.mjs unit
npm run test:stream:int        # node ops/validation/stream-validation.mjs int
npm run test:stream:e2e        # node ops/validation/stream-validation.mjs e2e
npm run test:stream:perf       # node ops/validation/stream-validation.mjs perf
npm run test:stream:all        # All stream tests
npm run validate:stream:gate   # Stream gate validation
npm run validate:prelive       # Pre-live checklist

# Mobile (Capacitor)
npm run cap:sync               # Build + cap sync
npm run cap:open:ios           # Open iOS project
npm run cap:open:android       # Open Android project
```

---

## 10. Key Source Files to Read Before Editing

| Task | Read First |
|------|-----------|
| Worker changes | `src/worker/index.ts` (route table at bottom), `src/worker/bindings.d.ts` |
| Stream/broadcast | `src/lib/stream/url-detector.ts`, `src/pages/Live.tsx`, `src/components/LiveStreamPlayer.tsx` |
| Auth/session | `src/worker/index.ts` → `getSession()`, `resolveUserRoles()`, `requireAuth()` |
| DB schema | `supabase/migrations/` (latest files), `docs/architecture/DB_SCHEMA_v1.2.0.md` |
| Public endpoints | `src/worker/routes/public.ts` |
| Testing | `src/test/setup.ts`, `vitest.config.ts` |
| Feature flags | `src/worker/bindings.d.ts` (Env interface) |

---

## 11. Anti-Patterns That Have Caused Production Incidents

| Date | Incident | Root Cause | Prevention |
|------|---------|------------|-----------|
| 2026-04-16 | Mock data shown live | `|| mockPlayers` fallbacks + public pages calling auth-required endpoints | ESLint guard + vitest guard |
| 2026-04-16 | Stats showing 0 | `/api/stats` required auth, anonymous callers got 401, fallback to mock | Made stats tier-aware; anonymous = limited data |
| Active | Game_id coupling | Treating stream tables as extensions of games | Stream Independence Contract test suite |

---

## 12. Agent Operating Checklist

Before every response:
- [ ] Did I read the actual file, not assume its contents?
- [ ] Did I check if the function/endpoint I'm referencing actually exists in the codebase?
- [ ] Will my change break any of the 94 test files?
- [ ] Did I run the validation gates locally before claiming they pass?
- [ ] Is the migration I'm writing NEW, not editing an existing file?
- [ ] Am I using the correct worker name (`sbbl-hq-worker`)?
- [ ] Am I using `LEAGUE_REGISTRY` from `src/lib/leagues.ts` for league data?

---

## 13. Media Intelligence Overhaul Overview

The 2026-05-13 Media Intelligence Overhaul (migration `20260513`) introduced a comprehensive set of media-management capabilities to the operations media library. New worker endpoints support bulk archive and restore of media publications, stale-item cleanup with preview and execute phases (dry-run then confirm), and pin/unpin operations to surface priority content. The parser now returns a confidence score alongside structured metadata, powered by a shared Zod schema in `src/lib/media/mediaParserSchema.ts`. Media search supports newest-first ordering, and drag-and-drop reordering is enabled via the `OpsMediaLibrary` component, which renders media cards in shadcn Sheet modals for inline editing and review. All new hooks (`useMedia*.ts`) encapsulate search, bulk operations, pin state, drag handling, stale cleanup, and upload flows.
