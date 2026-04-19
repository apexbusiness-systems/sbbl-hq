/**
 * MicUpIntroSting — once-per-session-per-game guard.
 *
 * Asserts that the sting only plays the first time it mounts for a
 * given gameId (in the same sessionStorage-backed tab), and that
 * prefers-reduced-motion skips the animation.
 *
 * Test strategy: set sessionStorage directly where relevant instead of
 * relying on React 18 useEffect flushing between two `render()` calls
 * in a single test. `render()` wraps in act() but effect execution
 * ordering on concurrent renderers can be subtle; seeding the storage
 * explicitly matches what the production flow does anyway (the sting
 * has already played once → marker is present) and eliminates the
 * cross-mount timing dependency entirely.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MicUpIntroSting } from '@/components/micup/MicUpIntroSting';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('MicUpIntroSting', () => {
  it('plays on first mount for a gameId', () => {
    const { getByTestId } = render(
      <MicUpIntroSting gameId="g-1" leftPlayerLabel="A" rightPlayerLabel="B" />,
    );
    expect(getByTestId('mic-up-intro-sting')).toBeInTheDocument();
  });

  it('does not play when sessionStorage already has the gameId marker', () => {
    // Seed the marker explicitly — the "second-mount" condition in prod.
    sessionStorage.setItem('sbbl-micup-intro:g-1', '1');
    const { queryByTestId } = render(
      <MicUpIntroSting gameId="g-1" leftPlayerLabel="A" rightPlayerLabel="B" />,
    );
    expect(queryByTestId('mic-up-intro-sting')).toBeNull();
  });

  it('plays for a different gameId even when another has been marked', () => {
    sessionStorage.setItem('sbbl-micup-intro:g-1', '1');
    const { getByTestId } = render(
      <MicUpIntroSting gameId="g-2" leftPlayerLabel="C" rightPlayerLabel="D" />,
    );
    expect(getByTestId('mic-up-intro-sting')).toBeInTheDocument();
  });

  it('skips the animation when prefers-reduced-motion is set', () => {
    // Stub matchMedia on window (jsdom's globalThis === window) so the
    // component's prefersReducedMotion() probe observes the override.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => ({
        matches: q.includes('reduce'),
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    const { queryByTestId } = render(
      <MicUpIntroSting gameId="g-reduced" leftPlayerLabel="A" rightPlayerLabel="B" />,
    );
    expect(queryByTestId('mic-up-intro-sting')).toBeNull();
  });
});
