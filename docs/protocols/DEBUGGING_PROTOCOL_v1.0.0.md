<!-- Version: v1.0.0 | Date: 2026-04-04 | Status: Current -->
# Debugging Protocol

**Version:** v1.0.0  
**Last Updated (UTC):** 2026-03-28

## 1) Incident Triage Sequence

1. Reproduce issue with exact route/user role/browser.
2. Capture console logs/network traces.
3. Determine severity class:
   - P1 critical outage
   - P2 major degradation
   - P3 functional bug
   - P4 cosmetic issue

## 2) Technical Isolation Flow

1. **Build integrity:** `npm run build`
2. **Type safety:** `npm run typecheck`
3. **Regression checks:** `npm run test`
4. **Lint and static policy:** `npm run lint`
5. **Targeted component trace:** inspect component props/state transitions.

## 3) Front-end-Specific Protocol

- Verify route-level lazy loading boundaries.
- Verify sticky/fixed overlays for collision and z-index layering.
- Verify browser autoplay policy handling for media components.

## 4) Root Cause Documentation Template

- Symptom
- Trigger conditions
- Root cause
- Affected surface area
- Mitigation
- Permanent fix
- Regression tests added

