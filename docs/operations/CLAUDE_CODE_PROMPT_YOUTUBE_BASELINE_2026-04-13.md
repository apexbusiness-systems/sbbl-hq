# Claude Code Prompt — Baseline YouTube Live Ingest + Re-Broadcast Workflow

Use this exact prompt in Claude Code to implement and validate the baseline workflow:

```text
You are working inside the SBBL HQ repo. Implement a production-safe "baseline YouTube live ingest + re-broadcast" flow.

GOAL
- Upstream: Switcher broadcasts to YouTube Live.
- In-platform: Admin pastes that YouTube Live URL in Ops, goes live, and platform broadcasts that same YouTube URL to viewers.

CONSTRAINTS
- Do not introduce new runtime dependencies.
- Keep current API contract stable unless strictly required.
- Preserve role gating (league_admin vs super_admin).
- Add robust URL validation and clear error messages.
- Keep existing idempotency behavior on mutating endpoints.
- No fake or placeholder logic.

IMPLEMENTATION TARGETS
1) Ops UI stream config flow (`src/pages/Ops.tsx`)
   - Ensure stream URL input explicitly supports YouTube watch/live/embed/share links.
   - Normalize accepted YouTube URL into a canonical playable URL (prefer embed/watch format used by player).
   - Show inline validation errors before submit.
   - Keep Go Live/End Stream controls unchanged in permissions.

2) Stream API client (`src/lib/api/stream.ts`)
   - Keep `collectionId` compatibility but improve docs/comments to reflect it is the configured stream URL.
   - Ensure update payload and status toggles remain backward compatible.

3) Playback rendering path (where live player URL is consumed)
   - Ensure canonical YouTube URL renders reliably in the existing player.
   - Handle malformed or missing URL gracefully (non-crashing fallback state).

4) Tests
   - Add/extend unit tests for:
     - YouTube URL acceptance matrix (watch/live/embed/youtu.be).
     - Rejection matrix (non-YouTube URLs, malformed URLs, empty input).
     - Normalization behavior.
   - Add/extend UI behavior tests for validation message and successful save path.

ACCEPTANCE CRITERIA
- Admin can paste a valid YouTube Live URL and save config.
- Admin can click Go Live and viewers receive playable live stream.
- Invalid URLs are blocked client-side with actionable feedback.
- Existing non-YouTube direct stream URLs are either (a) still supported or (b) explicitly rejected with a deliberate product decision documented in code comments/tests.
- All touched tests pass.

DELIVERABLE FORMAT
1) Brief diagnosis of current gaps.
2) File-by-file patch summary.
3) Actual code edits.
4) Test commands + output.
5) Rollback notes (what to revert if issues occur).
```

## Operator Notes
- If you want YouTube-only strict mode, add this line under **CONSTRAINTS** in the prompt:
  - `Reject all non-YouTube URLs with explicit UX copy: "Only YouTube Live URLs are allowed in baseline mode."`
- If you want compatibility mode, keep non-YouTube URLs supported and only normalize YouTube-specific links.
