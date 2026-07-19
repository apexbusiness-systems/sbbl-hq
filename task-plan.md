### ARTIFACT: Task Plan

**Mission:** Resolve audio stream issues by restoring volume and playback controls exclusively for user's own broadcast instance.

**Success Criteria:**
- `WhepPlayer` correctly surfaces native audio and volume elements.
- `LiveStreamPlayer` implements granular control for volume toggling.
- E2E tests for `whep-volume-controls.spec.ts` pass reliably.
- No regression on `ops-media-tabs.spec.ts` after fixing the API mock response shape.

**Constraints:**
- NEVER use hedging language.
- NEVER invent file paths or test results.
- Format: TypeScript strict, proper UI states.

**Agent Strategy:**
- Editor agent: Restored custom volume overlay in `LiveStreamPlayer`, updated E2E test `whep-volume-controls.spec.ts`, and fixed POTG parser API payload shape in `Ops.tsx`.
- Terminal agent: Executed E2E tests.
- Browser agent: N/A.

**Risk:** UI overlay conflicts with native browser controls.
**Rollback:** Revert `LiveStreamPlayer` to native `controls` attribute on `<video>` element.
