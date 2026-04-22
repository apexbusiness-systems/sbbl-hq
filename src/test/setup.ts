import "@testing-library/jest-dom";
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API for tests
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - safe polyfill for testing
  globalThis.crypto = webcrypto;
}

Object.defineProperty(window, "matchMedia", {
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
