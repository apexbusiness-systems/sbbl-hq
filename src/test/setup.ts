import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { createElement } from 'react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const reactPlayerStub = {
  default: (props: { url?: string }) => {
    const url = typeof props?.url === 'string' ? props.url : '';
    // Stable stub avoids dynamic provider imports in tests.
    return createElement('div', { 'data-testid': 'mock-react-player', 'data-url': url });
  },
};
vi.mock('react-player', () => reactPlayerStub);
vi.mock('react-player/lazy', () => reactPlayerStub);


afterEach(() => {
  // Force teardown between suites to prevent retained DOM/query clients/timers.
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
