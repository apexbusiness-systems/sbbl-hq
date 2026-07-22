# Corrections

Store durable correction records here.

Each correction should capture:
- date
- original wrong assumption
- corrected state
- scope: local, project-wide, global, or user-style
- affected pages
- promotion decision: page only, directive, or user-pattern rule

## Correction Index

- [[2026-07-18-cors-and-credentials-resolution.md]] — CORS local port whitelisting (8080) and local credentials separation via `.dev.vars`.
- [[2026-07-20-auth-loading-state-stabilization.md]] — Gating token refresh auth loading state resets, Playwright file upload stabilization, and ignoring live diagnostic tests in CI.
- [[2026-07-21-league-resolution-consolidation.md]] — League slug→UUID lookup consolidated into `resolveLeagueId`/`resolveLeagueIdFilter` (`src/worker/shared.ts`) after 8 drifted hand-rolled copies caused the `/ops/media` league-filter 500; CI guard blocks new copies.
- [[2026-07-22-web-analytics-cls-optimization.md]] — Web Analytics CLS elimination: reserved height containers and structural skeleton loaders across `/ops`, `/login`, `/teams`, and lazy route fallbacks.
