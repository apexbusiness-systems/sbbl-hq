# SBBL HQ Operations Runbook

**Version:** v1.0.1  
**Last Updated (UTC):** 2026-03-29

## 1) Purpose

This runbook describes repeatable operational steps for building, testing, deploying, and validating SBBL HQ.

---

## ⚠️ BEFORE YOU DO ANYTHING — READ THIS

This project has two separate env systems. Every agent incident on this project has been caused by confusing them.

**Build-time (Vite — goes into browser bundle):**

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ezanilxygnpucwkwpsoc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` anon JWT from Supabase dashboard → Project Settings → API |

**`VITE_SUPABASE_ANON_KEY` is canonical. `VITE_SUPABASE_PUBLISHABLE_KEY` is a dead alias. Never use it.**

If these are missing at `npm run build` time → `configAvailable = false` → auth banner → broken app.

They must exist as **GitHub Actions Secrets** AND in your local `.env` file.

**Worker runtime (Cloudflare — never browser):** Set via `wrangler secret put`. See `DEPLOY_CLOUDFLARE.md` for full list.

---

## 2) Standard Operating Procedure (SOP)

### 2.1 Pre-flight

1. Ensure Node/NPM environment is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify env files exist: `.env` and `.dev.vars` (copy from examples if not).
4. Verify quality gate:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```

### 2.2 Local Development

```bash
npm run dev
```

- Verify key routes: `/`, `/live`, `/schedules`, `/store`, `/profiles`, `/stats`, `/leaderboards`, `/media`, `/billing`, `/settings`, `/ops`.

### 2.3 Release Build

```bash
npm run build
```

> `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in the environment before running this command.

Expected outputs:
- `dist/index.html`
- `dist/assets/*`
- PWA files (`dist/sw.js`, workbox bundle)

### 2.4 Cloudflare Deployment

```bash
npm run cf:deploy
```

For staging:
```bash
npm run cf:deploy:staging
```

## 3) Rollback Plan

1. Revert to previous known-good git tag/commit.
2. Rebuild (`npm run build`) — ensure VITE env vars are present.
3. Redeploy previous artifact via Cloudflare deploy command.
4. Validate core routes and live/payment paths.

## 4) Health Verification Checklist

- [ ] App loads without runtime errors.
- [ ] No "Authentication temporarily unavailable" banner (if present: VITE_SUPABASE_ANON_KEY missing at build time).
- [ ] Header navigation works on desktop and mobile.
- [ ] Sticky music player remains visible bottom-right and responds to controls.
- [ ] Test suite and build pass.
- [ ] PWA service worker generated.

## 5) Escalation

- **P1 outage:** engage emergency protocol immediately.
- **P2 degradation:** triage within 1 hour.
- **P3/P4:** schedule in next sprint patch window.
