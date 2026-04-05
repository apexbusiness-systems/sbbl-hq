// auth_spike.js -- Spike-load test for authentication endpoints
//
// Run:
//   k6 run tests/k6/auth_spike.js \
//     -e BASE_URL=https://sbbl-hq.example.com \
//     -e SUPABASE_URL=https://xyz.supabase.co \
//     -e ANON_KEY=<anon-key> \
//     -e PROFILE=5k

import http from 'k6/http';
import { check, group } from 'k6';
import {
  BASE_URL,
  SUPABASE_URL,
  sloThresholds,
  buildHeaders,
  randomEmail,
  randomPassword,
} from './common.js';

// ---------------------------------------------------------------------------
// Options -- constant-arrival-rate for realistic spike patterns
// ---------------------------------------------------------------------------

const rateProfiles = {
  '5k':   { rate: 500,  duration: '5m',  preAllocatedVUs: 200,  maxVUs: 2000 },
  '20k':  { rate: 2000, duration: '8m',  preAllocatedVUs: 500,  maxVUs: 5000 },
  '50k':  { rate: 5000, duration: '15m', preAllocatedVUs: 1000, maxVUs: 10000 },
  '500k': { rate: 5000, duration: '15m', preAllocatedVUs: 1000, maxVUs: 10000 },
};

const profileName = __ENV.PROFILE || '5k';
const rp = rateProfiles[profileName];
if (!rp) {
  throw new Error(`Unknown PROFILE "${profileName}"`);
}

export const options = {
  scenarios: {
    auth_spike: {
      executor: 'constant-arrival-rate',
      rate: rp.rate,
      timeUnit: '1m',
      duration: rp.duration,
      preAllocatedVUs: rp.preAllocatedVUs,
      maxVUs: rp.maxVUs,
      exec: 'default',
    },
  },

  thresholds: {
    ...sloThresholds,

    // Auth-specific SLOs
    'http_req_duration{endpoint:login}':   ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{endpoint:signup}':  ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{endpoint:session}': ['p(95)<600', 'p(99)<1200'],
    'http_req_failed': ['rate<0.01'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function () {
  const email = randomEmail();
  const password = randomPassword();
  const headers = buildHeaders();

  group('Login attempt', () => {
    const res = http.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email, password }),
      { headers, tags: { endpoint: 'login' } },
    );

    check(res, {
      'login returns 2xx or 4xx (no 5xx)': (r) => r.status < 500,
      'login response has body': (r) => r.body && r.body.length > 0,
    });
  });

  group('Signup attempt', () => {
    const res = http.post(
      `${SUPABASE_URL}/auth/v1/signup`,
      JSON.stringify({ email, password }),
      { headers, tags: { endpoint: 'signup' } },
    );

    // Some failures expected from rate limiting -- that is OK.
    check(res, {
      'signup returns 2xx or 429': (r) =>
        (r.status >= 200 && r.status < 300) || r.status === 429,
      'signup no 5xx': (r) => r.status < 500,
    });
  });

  group('Session check', () => {
    const res = http.get(`${BASE_URL}/auth/session`, {
      headers,
      tags: { endpoint: 'session' },
    });

    check(res, {
      'session returns 2xx or 401': (r) =>
        (r.status >= 200 && r.status < 300) || r.status === 401,
      'session no 5xx': (r) => r.status < 500,
    });
  });
}
