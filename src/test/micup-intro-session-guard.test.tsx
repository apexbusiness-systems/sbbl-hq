/**
 * MicUpIntroSting — once-per-session-per-game guard.
 *
 * Asserts that the sting only plays the first time it mounts for a
 * given gameId (in the same sessionStorage-backed tab), and that
 * prefers-reduced-motion skips the animation.
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

  it('does not play on second mount for the same gameId (session guard)', () => {
    render(<MicUpIntroSting gameId="g-1" leftPlayerLabel="A" rightPlayerLabel="B" />);
    const second = render(
      <MicUpIntroSting gameId="g-1" leftPlayerLabel="A" rightPlayerLabel="B" />,
    );
    expect(second.queryByTestId('mic-up-intro-sting')).toBeNull();
  });

  it('still plays for a different gameId after the first has been marked', () => {
    render(<MicUpIntroSting gameId="g-1" leftPlayerLabel="A" rightPlayerLabel="B" />);
    const next = render(
      <MicUpIntroSting gameId="g-2" leftPlayerLabel="C" rightPlayerLabel="D" />,
    );
    expect(next.getByTestId('mic-up-intro-sting')).toBeInTheDocument();
  });

  it('skips the animation when prefers-reduced-motion is set', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      media: q,
      onchange: null,
    }));
    const { queryByTestId } = render(
      <MicUpIntroSting gameId="g-reduced" leftPlayerLabel="A" rightPlayerLabel="B" />,
    );
    expect(queryByTestId('mic-up-intro-sting')).toBeNull();
  });
});
