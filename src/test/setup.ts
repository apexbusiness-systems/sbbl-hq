import { vi } from 'vitest';
import '@testing-library/jest-dom';
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

vi.mock('react-player', () => ({
  default: (props: { url?: string }) => {
    const url = typeof props?.url === 'string' ? props.url : '';
    // Stable stub avoids dynamic provider imports in tests.
    return createElement('div', { 'data-testid': 'mock-react-player', 'data-url': url });
  },
}));
