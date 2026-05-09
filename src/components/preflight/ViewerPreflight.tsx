/**
 * Viewer preflight — orchestrator.
 *
 * Composes the preflight panel:
 *   1. Probes browser capabilities (autoplay, connection, UA).
 *   2. Consumes the server snapshot (passed in — this component does NOT
 *      fetch. The parent page owns fetch + cache policy.).
 *   3. Runs the pure check battery.
 *   4. Renders the staggered checklist + event card + remediation CTA.
 *   5. Dispatches remediation actions to the parent.
 *
 * Feature flag gating lives in the parent page. This component always
 * renders when mounted; mount it conditionally on
 * `FEATURE_SHOW_VIEWER_PREFLIGHT`.
 */
import { useEffect, useMemo, useState } from 'react';
import { BasketballPulseLoader } from './BasketballPulseLoader';
import { PreflightCheckItem } from './PreflightCheckItem';
import { PreflightEventCard } from './PreflightEventCard';
import { PreflightRemediation } from './PreflightRemediation';
import {
  aggregateVerdict,
  runAllChecks,
  type BrowserCapabilities,
} from '@/lib/preflight/checks';
import type { CheckResult, PreflightSnapshot } from '@/lib/preflight/types';

interface Props {
  /** Human-readable event title shown at the top of the card. */
  title: string;
  /** Server snapshot. `null` = still loading; `error` = fetch failed. */
  snapshot: PreflightSnapshot | null;
  snapshotError?: Error | null;
  /** Invoked when a remediation CTA is clicked. */
  onRemediate: (result: CheckResult) => void;
  /**
   * Called exactly once when aggregate verdict first transitions to
   * `ready`. Page parent uses this to unmount the preflight and reveal
   * the player.
   */
  onReady?: () => void;
  /** Called when the user clicks the manual retry button after an error. */
  onRetry?: () => void;
  /**
   * Capability override for tests. In production, probes run real APIs.
   */
  capabilitiesOverride?: BrowserCapabilities;
}

async function probeAutoplay(): Promise<boolean> {
  if (typeof document === 'undefined') return true;
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    // 1x1 transparent mp4 is not universally supported; simpler to trust
    // the promise contract: play() on a muted empty video resolves when
    // autoplay is allowed, rejects otherwise.
    const p = v.play();
    if (p && typeof p.then === 'function') {
      try {
        await p;
        return true;
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function probeCapabilities(): Omit<BrowserCapabilities, 'canAutoplayMutedVideo'> {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      effectiveType: undefined,
      isPwaCapable: false,
    };
  }
  const conn = (navigator as unknown as {
    connection?: { effectiveType?: BrowserCapabilities['effectiveType'] };
  }).connection;
  return {
    userAgent: navigator.userAgent,
    effectiveType: conn?.effectiveType,
    isPwaCapable: 'serviceWorker' in navigator,
  };
}

export function ViewerPreflight({
  title,
  snapshot,
  snapshotError,
  onRemediate,
  onReady,
  onRetry,
  capabilitiesOverride,
}: Props) {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(
    capabilitiesOverride ?? null,
  );
  const [readyFired, setReadyFired] = useState(false);

  useEffect(() => {
    if (capabilitiesOverride) {
      setCapabilities(capabilitiesOverride);
      return;
    }
    let cancelled = false;
    void (async () => {
      const base = probeCapabilities();
      const canAutoplay = await probeAutoplay();
      if (!cancelled) {
        setCapabilities({ ...base, canAutoplayMutedVideo: canAutoplay });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capabilitiesOverride]);

  const results = useMemo<CheckResult[] | null>(() => {
    if (!snapshot || !capabilities) return null;
    return runAllChecks(snapshot, capabilities);
  }, [snapshot, capabilities]);

  const verdict = useMemo(() => {
    if (!results) return 'pending' as const;
    return aggregateVerdict(results);
  }, [results]);

  useEffect(() => {
    if (verdict === 'ready' && !readyFired) {
      setReadyFired(true);
      onReady?.();
    }
  }, [verdict, readyFired, onReady]);

  if (snapshotError) {
    return (
      <div
        role="alert"
        data-testid="preflight-error"
        className="p-4 rounded-md border border-destructive/30 bg-destructive/5"
      >
        <div className="text-sm font-medium mb-1">Preflight check failed to load</div>
        <div className="text-xs text-muted-foreground mb-3">{snapshotError.message}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-sm bg-primary text-primary-foreground hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!results || !snapshot) {
    return (
      <div
        data-testid="preflight-loading"
        className="p-6 rounded-md border border-border bg-card flex items-center gap-3"
      >
        <BasketballPulseLoader size={36} />
        <span className="text-sm text-muted-foreground">Running preflight checks…</span>
      </div>
    );
  }

  const firstFail = results.find((r) => r.status === 'fail' && r.remediation);

  return (
    <div
      data-testid="viewer-preflight"
      data-verdict={verdict}
      className="w-full max-w-md mx-auto flex flex-col gap-3"
    >
      <PreflightEventCard
        title={title}
        state={snapshot.game.state}
        tipoffAt={snapshot.game.tipoffAt}
        ppvPriceCad={snapshot.game.ppvPriceCad}
      />
      <div className="flex flex-col gap-2">
        {results.map((r, idx) => (
          <PreflightCheckItem
            key={r.id}
            result={r}
            revealDelayMs={idx * 80}
            onRemediate={onRemediate}
          />
        ))}
      </div>
      {firstFail && <PreflightRemediation result={firstFail} onRemediate={onRemediate} />}
    </div>
  );
}
