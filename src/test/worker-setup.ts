import { vi } from 'vitest';

// Mock Cloudflare Worker caches API — `CacheStorage.default` is a CF extension
// not present in the DOM lib types, so we cast through unknown.
const mockCache = {
  match: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
};

global.caches = {
  default: mockCache,
} as unknown as typeof caches;

// Mock Sentry
vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
}));
