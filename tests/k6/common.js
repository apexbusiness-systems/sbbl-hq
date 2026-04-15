// common.js -- Shared utilities for SBBL-HQ k6 load tests

export const BASE_URL = __ENV.BASE_URL || 'https://sbbl-hq.icu';
export const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://ezanilxygnpucwkwpsoc.supabase.co';
export const ANON_KEY = __ENV.ANON_KEY || '';

// ---------------------------------------------------------------------------
// VU Profiles
// ---------------------------------------------------------------------------

const profiles = {
  '5k': {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 2500 },
      { duration: '1m', target: 5000 },
      { duration: '3m', target: 5000 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  '10k': {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 2500 },
      { duration: '1m', target: 5000 },
      { duration: '1m', target: 7500 },
      { duration: '1m', target: 10000 },
      { duration: '3m', target: 10000 },
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
};

/**
 * Return a scenarios object keyed by `scenarioName` using the chosen profile.
 * @param {string} scenarioName
 * @param {string} [profileName] - one of 5k | 10k | 20k | 50k
 */
export function getScenarios(scenarioName, profileName) {
  const name = profileName || __ENV.PROFILE || '10k';
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

export function randomEmail() {
  return `loadtest+${randomString(10)}@sbbl-hq.test`;
}

export function randomPassword() {
  return `Lt!${randomString(9)}A1`;
}

/**
 * Build common request headers.
 * @param {string} [token] - optional Bearer token
 * @returns {object} headers
 */
export function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'k6-sbbl-load-test/1.0',
  };
  if (ANON_KEY) {
    headers['apikey'] = ANON_KEY;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
