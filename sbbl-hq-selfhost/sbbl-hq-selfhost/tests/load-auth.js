/**
 * SBBL-HQ Auth Load Test — k6
 * Tests auth endpoints under high-concurrency live-event conditions.
 *
 * Install k6:  https://k6.io/docs/getting-started/installation/
 * Run:
 *   k6 run \
 *     --env SUPABASE_URL=https://sbbl-hq.icu \
 *     --env ANON_KEY=<your-anon-key> \
 *     tests/load-auth.js
 *
 * Phase model:
 *   - Ramp up to 1 000 VUs (simulates pre-game login rush)
 *   - Hold 5 000 VUs for 3 minutes (peak live-event load)
 *   - Ramp down to 500 VUs (steady-state post-game)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────
const loginSuccess  = new Counter('login_success');
const loginFail     = new Counter('login_fail');
const signupSuccess = new Counter('signup_success');
const captchaReject = new Counter('captcha_reject');
const authErrorRate = new Rate('auth_error_rate');
const loginLatency  = new Trend('login_latency_ms', true);

// ── Load shape ────────────────────────────────────────────
export const options = {
  scenarios: {
    // Simulates the pre-game login surge
    login_surge: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 1000  },  // ramp to 1K
        { duration: '3m',  target: 5000  },  // hold peak
        { duration: '2m',  target: 500   },  // post-game
        { duration: '30s', target: 0     },  // drain
      ],
      gracefulRampDown: '30s',
    },
    // Constant background: token refresh from existing sessions
    session_refresh: {
      executor: 'constant-vus',
      vus: 200,
      duration: '6m30s',
      startTime: '30s',
    },
  },
  thresholds: {
    // Auth latency SLOs
    'login_latency_ms': [
      'p(50) < 200',   // median under 200ms
      'p(95) < 600',   // p95 under 600ms
      'p(99) < 1200',  // p99 under 1.2s
    ],
    'auth_error_rate':        ['rate < 0.01'],   // <1% error rate
    'http_req_failed':        ['rate < 0.01'],
    'http_req_duration':      ['p(95) < 800'],
  },
};

const BASE = __ENV.SUPABASE_URL  || 'https://sbbl-hq.icu';
const KEY  = __ENV.ANON_KEY      || '';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': KEY,
};

// ── Test accounts (pre-created in staging) ────────────────
// For a real load test, generate a pool of test users first.
const TEST_USERS = Array.from({ length: 100 }, (_, i) => ({
  email:    `loadtest_${i}@sbbl-hq-test.invalid`,
  password: `LoadTest#${i}Str0ng2026!`,
}));

function randomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// ── Default scenario: login + session refresh ─────────────
export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;

  if (scenario === 'session_refresh') {
    // Simulate refresh token flow
    const res = http.post(
      `${BASE}/auth/v1/token?grant_type=refresh_token`,
      JSON.stringify({ refresh_token: 'synthetic_for_load_only' }),
      { headers: HEADERS }
    );
    // 400 is expected (fake token) — we're testing the endpoint is alive under load
    check(res, { 'refresh endpoint alive': (r) => r.status < 500 });
    sleep(Math.random() * 2 + 1);
    return;
  }

  // Login flow
  const user  = randomUser();
  const start = Date.now();

  const res = http.post(
    `${BASE}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: HEADERS, tags: { name: 'auth_login' } }
  );

  loginLatency.add(Date.now() - start);

  const ok = check(res, {
    'login 200':           (r) => r.status === 200,
    'has access_token':    (r) => r.status === 200 && r.json('access_token') !== undefined,
    'no server error':     (r) => r.status < 500,
  });

  if (res.status === 200) {
    loginSuccess.add(1);
  } else if (res.status === 400 && res.body && res.body.includes('captcha')) {
    captchaReject.add(1);
  } else {
    loginFail.add(1);
    authErrorRate.add(1);
  }

  sleep(Math.random() * 1.5 + 0.5);
}

// ── Signup scenario (separate run for onboarding load) ───
export function signup() {
  const email = `new_${Date.now()}_${Math.random().toString(36).slice(2)}@sbbl-hq-test.invalid`;
  const res = http.post(
    `${BASE}/auth/v1/signup`,
    JSON.stringify({
      email,
      password: 'Signup#Test2026!',
      // NOTE: In production, pass a real Turnstile token.
      // Omit here for load test against a CAPTCHA-disabled staging env.
    }),
    { headers: HEADERS, tags: { name: 'auth_signup' } }
  );
  const ok = check(res, {
    'signup 200 or 422': (r) => [200, 422, 400].includes(r.status),
    'no server error':   (r) => r.status < 500,
  });
  if (res.status === 200) signupSuccess.add(1);
  sleep(Math.random() * 3 + 1);
}
