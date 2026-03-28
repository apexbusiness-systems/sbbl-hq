# SBBL HQ Operations Runbook

**Version:** v1.0.0  
**Last Updated (UTC):** 2026-03-28

## 1) Purpose

This runbook describes repeatable operational steps for building, testing, deploying, and validating SBBL HQ.

## 2) Standard Operating Procedure (SOP)

### 2.1 Pre-flight

1. Ensure Node/NPM environment is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify quality gate:
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
2. Rebuild (`npm run build`).
3. Redeploy previous artifact via Cloudflare deploy command.
4. Validate core routes and live/payment paths.

## 4) Health Verification Checklist

- [ ] App loads without runtime errors.
- [ ] Header navigation works on desktop and mobile.
- [ ] Sticky music player remains visible bottom-right and responds to controls.
- [ ] Test suite and build pass.
- [ ] PWA service worker generated.

## 5) Escalation

- **P1 outage:** engage emergency protocol immediately.
- **P2 degradation:** triage within 1 hour.
- **P3/P4:** schedule in next sprint patch window.

