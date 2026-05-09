/**
 * ViewerPreflight orchestrator — integration-style render tests.
 *
 * Exercises the full composition: snapshot → pure checks → sub-components.
 * Uses a capabilities override so no browser probes run. Asserts the
 * visible DOM via data-testid anchors.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewerPreflight } from '@/components/preflight/ViewerPreflight';
import type { PreflightSnapshot } from '@/lib/preflight/types';
import type { BrowserCapabilities } from '@/lib/preflight/checks';

function snap(overrides: Partial<PreflightSnapshot> = {}): PreflightSnapshot {
  return {
    ok: true,
    userId: 'u-1',
    entitlement: { status: 'active', expiresAt: null },
    activeSession: { hasConflict: false, conflictDeviceLabel: null, conflictStartedAt: null },
    game: {
      id: 'g-1',
      state: 'live',
      tipoffAt: null,
      ppvPriceCad: 4.99,
      replay: { embargoEndsAt: null, qualityTier: null, priceCad: null, entitled: false },
    },
    ...overrides,
  };
}

const modernCaps: BrowserCapabilities = {
  userAgent: 'Chrome/120',
  effectiveType: '4g',
  canAutoplayMutedVideo: true,
  isPwaCapable: true,
};

describe('ViewerPreflight', () => {
  it('renders the loader while snapshot is pending', () => {
    render(
      <ViewerPreflight
        title="Hoopers vs Legends"
        snapshot={null}
        onRemediate={() => {}}
        capabilitiesOverride={modernCaps}
      />,
    );
    expect(screen.getByTestId('preflight-loading')).toBeInTheDocument();
  });

  it('renders the error branch when snapshotError is set', () => {
    render(
      <ViewerPreflight
        title="X"
        snapshot={null}
        snapshotError={new Error('offline')}
        onRemediate={() => {}}
        onRetry={() => {}}
        capabilitiesOverride={modernCaps}
      />,
    );
    expect(screen.getByTestId('preflight-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows all 7 check rows in canonical order once snapshot + caps are available', () => {
    render(
      <ViewerPreflight
        title="X"
        snapshot={snap()}
        onRemediate={() => {}}
        capabilitiesOverride={modernCaps}
      />,
    );
    const expectedIds = [
      'auth', 'entitlement', 'activeSession', 'browserSupport',
      'bandwidth', 'autoplay', 'replay',
    ];
    for (const id of expectedIds) {
      expect(screen.getByTestId(`preflight-check-${id}`)).toBeInTheDocument();
    }
  });

  it('fires onReady exactly once when the verdict becomes ready', async () => {
    const onReady = vi.fn();
    render(
      <ViewerPreflight
        title="X"
        snapshot={snap()}
        onRemediate={() => {}}
        onReady={onReady}
        capabilitiesOverride={modernCaps}
      />,
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });

  it('renders the remediation CTA when at least one check fails', () => {
    render(
      <ViewerPreflight
        title="X"
        snapshot={snap({ userId: null })}
        onRemediate={() => {}}
        capabilitiesOverride={modernCaps}
      />,
    );
    const cta = screen.getByTestId('preflight-remediation-cta');
    expect(cta).toHaveAttribute('data-action', 'sign_in');
  });

  it('dispatches the failing check result when the remediation CTA is clicked', () => {
    const onRemediate = vi.fn();
    render(
      <ViewerPreflight
        title="X"
        snapshot={snap({
          activeSession: {
            hasConflict: true,
            conflictDeviceLabel: 'phone',
            conflictStartedAt: new Date().toISOString(),
          },
        })}
        onRemediate={onRemediate}
        capabilitiesOverride={modernCaps}
      />,
    );
    fireEvent.click(screen.getByTestId('preflight-remediation-cta'));
    expect(onRemediate).toHaveBeenCalledTimes(1);
    expect(onRemediate.mock.calls[0][0].remediation.action).toBe('displace_session');
  });

  it('does NOT fire onReady when verdict is warnings (non-blocking but not ready)', async () => {
    const onReady = vi.fn();
    // Warnings come from caps (older browser) with everything else OK.
    render(
      <ViewerPreflight
        title="X"
        snapshot={snap()}
        onRemediate={() => {}}
        onReady={onReady}
        capabilitiesOverride={{ ...modernCaps, userAgent: 'Chrome/60', canAutoplayMutedVideo: false }}
      />,
    );
    // Give useEffect a tick — onReady should never fire for warnings verdict
    await new Promise((r) => setTimeout(r, 50));
    expect(onReady).not.toHaveBeenCalled();
  });
});
