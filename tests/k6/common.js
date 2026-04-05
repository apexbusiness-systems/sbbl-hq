// common.js -- Shared utilities for SBBL-HQ k6 load tests

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';
export const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
export const ANON_KEY = __ENV.ANON_KEY || '';

// ---------------------------------------------------------------------------
// VU Profiles
// ---------------------------------------------------------------------------

const profiles = {
  '5k': {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 5000 },
      { duration: '3m', target: 5000 },
      { duration: '2m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  '20k': {
    executor: 'ramping-vus',
    stages: [
      { duration: '5m', target: 20000 },
      { duration: '5m', target: 20000 },
      { duration: '3m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  '50k': {
    executor: 'ramping-vus',
    stages: [
      { duration: '10m', target: 50000 },
      { duration: '10m', target: 50000 },
      { duration: '5m', target: 0 },
    ],
    gracefulRampDown: '60s',
  },
  '500k': {
    // 500k is edge-only; tested via cached endpoints with the same shape as 50k.
    executor: 'ramping-vus',
    stages: [
      { duration: '10m', target: 50000 },
      { duration: '10m', target: 50000 },
      { duration: '5m', target: 0 },
    ],
    gracefulRampDown: '60s',
  },
};

/**
 * Return a scenarios object keyed by `scenarioName` using the chosen profile.
 *
 * @param {string} scenarioName - logical name used as the scenario key
 * @param {string} [profileName] - one of 5k | 20k | 50k | 500k (reads __ENV.PROFILE when omitted)
 * @returns {object} k6 scenarios config
 */
export function getScenarios(scenarioName, profileName) {
  const name = profileName || __ENV.PROFILE || '5k';
  const profile = profiles[name];
  if (!profile) {
    throw new Error(`Unknown profile "${name}". Choose from: ${Object.keys(profiles).join(', ')}`);
  }
  return { [scenarioName]: { ...profile, exec: 'default' } };
}

// ---------------------------------------------------------------------------
// SLO Thresholds (baseline -- individual scripts may extend)
// ---------------------------------------------------------------------------

export const sloThresholds = {
  http_req_duration: [
    { threshold: 'p(95)<500', abortOnFail: false },
    { threshold: 'p(99)<1500', abortOnFail: false },
  ],
  http_req_failed: [
    { threshold: 'rate<0.01', abortOnFail: false },
  ],
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random email address for signup/login tests.
 */
export function randomEmail() {
  return `loadtest+${randomString(10)}@sbbl-hq.test`;
}

/**
 * Generate a random password that satisfies typical requirements (12 chars, mixed).
 */
export function randomPassword() {
  return `Lt!${randomString(9)}A1`;
}

/**
 * Build common request headers.
 *
 * @param {string} [token] - optional Bearer token
 * @returns {object} headers
 */
export function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (ANON_KEY) {
    headers['apikey'] = ANON_KEY;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
