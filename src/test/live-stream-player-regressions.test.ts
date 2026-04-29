/**
 * Regression guards for two LiveStreamPlayer bugs fixed in commits
 * fd4bf71 and 820949e:
 *
 *   1. Orphaned timers: the 6-hour session-cap setTimeout and the 3-second
 *      auto-retry setTimeout were started without retaining their handles,
 *      so the unmount cleanup could not cancel them. The cap timer pinned
 *      the heartbeat closure in memory for up to six hours; the retry timer
 *      could call setPlaying on a torn-down player.
 *
 *   2. Conflicting position class: the Gate-2 wrapper used both
 *      'absolute inset-0' AND 'relative' on the same element. Tailwind's
 *      generated CSS resolves 'position: relative' last, so the wrapper
 *      dropped out of its absolute-positioned ancestor and collapsed to
 *      content-height, leaving the player iframe rendered at min-height
 *      with controls floating mid-canvas.
 *
 * These checks read the source verbatim — they are intentionally cheap
 * and deterministic and prevent the exact regression from re-landing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'components',
  'LiveStreamPlayer.tsx',
);

const SOURCE = readFileSync(SOURCE_PATH, 'utf8');

describe('LiveStreamPlayer regression guards', () => {
  describe('Gate-2 wrapper position class (fix 820949e)', () => {
    it('Gate-2 wrapper does not combine "absolute" with "relative"', () => {
      // The bug: className="absolute inset-0 flex flex-col relative z-0".
      // Tailwind emits position:relative last, collapsing the wrapper.
      // The fix: drop "relative". z-0 alone gives the absolute child its
      // own stacking context.
      const conflict = /className="absolute inset-0 flex flex-col relative z-0"/;
      expect(SOURCE).not.toMatch(conflict);
    });

    it('Gate-2 wrapper retains absolute positioning + stacking context', () => {
      // Sanity: the corrected className must still be present so the
      // wrapper fills its absolute-positioned ancestor and reaction
      // overlays/watermark/RBAC pill keep their z-order.
      expect(SOURCE).toMatch(/className="absolute inset-0 flex flex-col z-0"/);
    });
  });

  describe('Unsupported-provider short-circuit (Facebook + walled gardens)', () => {
    it('detects Facebook URLs as a distinct branch', () => {
      // The bug: when the configured stream URL was a Facebook page
      // (e.g. https://www.facebook.com/boxontrack2019), ReactPlayer's
      // facebook provider tried to load connect.facebook.net/sdk.js and
      // tripped the script-src CSP, then fell through to FilePlayer which
      // dies with "Stream error: The element has no supported sources."
      // Bail before mount instead.
      expect(SOURCE).toMatch(/const isFacebook = urlType === 'facebook'/);
    });

    it('renders an advisory before ReactPlayer can mount on Facebook URLs', () => {
      // The advisory must short-circuit (early return) — not a flag that
      // gates props on the mounted player. ReactPlayer must never see a
      // Facebook URL or it will load the SDK script.
      expect(SOURCE).toMatch(/if \(isFacebook\) \{[\s\S]*?return \(/);
      expect(SOURCE).toMatch(/Facebook Stream Not Supported/);
    });

    it('also short-circuits Kick / Instagram / X-Spaces (no public embed surface)', () => {
      expect(SOURCE).toMatch(
        /const isUnembeddable =\s*urlType === 'kick' \|\| urlType === 'instagram' \|\| urlType === 'x-spaces'/,
      );
      expect(SOURCE).toMatch(/if \(isUnembeddable\) \{[\s\S]*?return \(/);
    });
  });

  describe('Timer cleanup (fix fd4bf71)', () => {
    it('captures the 6-hour hard-cap setTimeout handle', () => {
      // Before: setTimeout(() => { ... }, msUntilCap) — handle thrown away.
      // After:  hardCapTimerId = globalThis.setTimeout(...).
      expect(SOURCE).toMatch(
        /hardCapTimerId\s*=\s*globalThis\.setTimeout\(/,
      );
    });

    it('clears the 6-hour hard-cap timer in the effect cleanup', () => {
      // The cleanup must explicitly clear the cap timer; otherwise the
      // closure stays in the event loop for up to 6 hours after unmount.
      expect(SOURCE).toMatch(/if \(hardCapTimerId\) clearTimeout\(hardCapTimerId\)/);
    });

    it('declares hardCapTimerId next to the heartbeat handle', () => {
      // Co-locating the two handles makes it obvious that BOTH must be
      // cleared symmetrically — the prior bug was caused by storing
      // heartbeatId but forgetting to store the cap timer.
      expect(SOURCE).toMatch(
        /let heartbeatId:[\s\S]{0,500}let hardCapTimerId:/,
      );
    });

    it('captures the auto-retry setTimeout handle in a ref', () => {
      // Before: setTimeout(() => setPlaying(true), 3_000) — fire-and-forget.
      // After:  autoRetryTimerRef.current = setTimeout(...).
      expect(SOURCE).toMatch(
        /autoRetryTimerRef\.current\s*=\s*setTimeout\(/,
      );
    });

    it('clears any pending auto-retry timer before scheduling a new one', () => {
      // Defensive: a second transient error inside the 3-second window
      // must not leak the prior timer.
      expect(SOURCE).toMatch(
        /if \(autoRetryTimerRef\.current\) clearTimeout\(autoRetryTimerRef\.current\)/,
      );
    });

    it('clears the auto-retry timer on component unmount', () => {
      // The dedicated cleanup useEffect — without it, navigating away
      // mid-retry would call setPlaying on a torn-down ReactPlayer.
      const cleanupBlock =
        /useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*?clearTimeout\(autoRetryTimerRef\.current\)[\s\S]*?\};\s*\},\s*\[\]\)/;
      expect(SOURCE).toMatch(cleanupBlock);
    });
  });
});
