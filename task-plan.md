### ARTIFACT: Task Plan

**Mission:** Execute a zero-tech-debt quantum audit, performance optimization, data pipeline verification, and comprehensive build validation to guarantee 100% commercial-grade production status for SBBL-HQ.

**Success Criteria:**
- TypeScript strict type check (`npm run typecheck`): 0 errors, exit code 0
- ESLint static analysis (`npm run lint`): 0 warnings, exit code 0
- Comprehensive Vitest suite (`npm test`): 132 test files passed, 1364 tests passed, exit code 0
- Production bundle build (`npm run build`): 3271 modules transformed cleanly, dist generated, exit code 0
- SonarCloud Quality Gate status: A-grade rating across reliability, security, maintainability, and coverage
- Full compliance with `omni-recall` memory directives, quality bar, and user operating model

**Constraints:**
- NEVER invent file paths, test results, CI status, SonarCloud grades, or "done" claims without fresh machine-verifiable evidence.
- NEVER use hedging language ("maybe", "might", "could", "probably", "I think", "should be fine", "likely").
- Format: TypeScript strict (`"strict": true`), ESLint clean (0 warnings), Ruff/E501 compliant, idempotent.

**Dependencies:**
- `@supabase/supabase-js` ^2.57.2
- `vite` ^5.4.19
- `typescript` ^5.8.3
- `@sentry/react` ^10.47.0
- `vitest` ^3.2.4
- `@playwright/test` ^1.60.0

**Risk Assessment:**
- Risk: Potential runtime configuration drift between environment variables and worker endpoints.
- Rollback: Enforce runtime configuration guard (`src/test/runtime-config.test.ts`) fallback mechanism to maintain single source of truth.

**Agent Strategy:**
- Editor agent: Surgical audit and minimal diff maintenance across `src/pages/Ops.tsx`, `src/lib/env.ts`, and core streaming/data pipeline modules.
- Terminal agent: Synchronous execution of type check, linting, test suite execution, and production bundling with strict exit code gates (Auto risk-aware mode).
- Browser agent: Verification of end-to-end user journeys and self-host ingest flows via Playwright engine.
