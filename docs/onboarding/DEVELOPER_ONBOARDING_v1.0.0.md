# Developer Onboarding Guide

**Version:** v1.0.0  
**Last Updated (UTC):** 2026-03-28

## 1) Quick Start (15 minutes)

1. Clone repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open app and inspect primary pages.

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

