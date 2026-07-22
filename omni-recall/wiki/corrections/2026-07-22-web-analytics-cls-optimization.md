# Correction Entry: Web Analytics CLS Optimization & Layout Stabilization

**Date:** 2026-07-22  
**Scope:** Frontend Performance / Web Analytics / UI Layout Stability  
**Status:** Permanent Directive  

## Original Wrong State
- `/ops` route experienced Cumulative Layout Shift (CLS: 0.131) due to dynamic loading of `pipelineHealthQuery` metrics into the same grid container as static system overview panels, displacing the `Recent Actions` section downwards post-mount.
- `/login` route had CLS shifts when `getRuntimeConfig()` asynchronously resolved `googleOAuthEnabled: true`, replacing a paragraph text element with a ~76px divider + OAuth button block.
- `/teams` route used unreserved text fallbacks (`Loading teams data...`) during query execution, reflowing the page height when standings cards mounted.
- Lazy route suspense fallback (`RouteFallback` in `App.tsx`) did not reserve standard container height (`min-h-[calc(100vh-8rem)]`), causing layout collapse during route transitions.

## Corrected State
- Dynamic grid metrics in `Ops.tsx` are separated from static counters and wrapped in dedicated containers with fixed skeleton placeholders and reserved minimum heights (`min-h-[480px]`).
- The Google OAuth section in `Login.tsx` is wrapped in a reserved layout container (`min-h-[76px] flex flex-col justify-center`), ensuring vertical form alignment remains invariant regardless of async configuration timing.
- `Teams.tsx` renders a multi-card skeleton container matching standings panel heights during loading states.
- `App.tsx` `<RouteFallback />` reserves full page container height (`min-h-[calc(100vh-8rem)]`).

## Permanent Operating Rules
1. Never mix dynamic async query cards and static section headers in unconstrained grid containers without skeleton fallbacks.
2. Async feature toggles (such as OAuth providers) MUST be mounted within fixed-height layout wrappers.
3. Every page loading state MUST reserve container aspect ratio / height (`min-h-[calc(100vh-8rem)]` or explicit panel skeletons) to maintain 100% Good Web Vitals (CLS < 0.01).
