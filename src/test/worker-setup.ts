import { vi } from 'vitest';

// Mock Cloudflare Worker caches API
const mockCache = {
  match: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
};

// @ts-ignore - stubbing global caches
global.caches = {
  default: mockCache,
};

// Mock Sentry
vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
}));
