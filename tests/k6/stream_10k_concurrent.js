/**
 * stream_10k_concurrent.js
 * SBBL HQ — 10,000 concurrent viewer simulation
 *
 * Simulates the complete viewer journey under game-day peak load:
 *   1. Poll /api/streams/status (every viewer, every 15s)
 *   2. Load the Live page HTML (initial page navigation)
 *   3. Simulate a playback session creation (authenticated viewers)
 *   4. Simulate heartbeat bursts (active sessions)
 *   5. Post live chat messages (engaged fraction: 5%)
 *   6. Post reactions (engaged fraction: 15%)
 *
 * SLO gates (investor-grade):
 *   - HTTP 5xx rate         < 0.1%  (hard fail)
 *   - HTTP 4xx error rate   < 1.0%  (expected auth rejections OK)
 *   - p95 status poll       < 500ms
 *   - p99 status poll       < 1500ms
 *   - p95 page load         < 800ms
 *   - p99 page load         < 2000ms
 *
 * Run:
 *   k6 run tests/k6/stream_10k_concurrent.js \
 *     -e BASE_URL=https://sbbl-hq.icu \
 *     -e PROFILE=10k
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, buildHeaders } from './common.js';

// Custom metrics
const errorRate5xx   = new Rate('stream_5xx_rate');
const statusPollTime = new Trend('stream_status_poll_ms', true);
const pageLoadTime   = new Trend('stream_page_load_ms', true);
const sessionReqTime = new Trend('stream_session_create_ms', true);
const heartbeatTime  = new Trend('stream_heartbeat_ms', true);
const chatPostTime   = new Trend('stream_chat_post_ms', true);

const GAME_ID_PROBE  = 'broadcast';

export const options = {
  scenarios: {
    stream_10k_viewers: {
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
  },

  thresholds: {
    'stream_5xx_rate':          ['rate<0.001'],
    'http_req_failed':          ['rate<0.01'],
    'stream_status_poll_ms':    ['p(95)<500', 'p(99)<1500'],
    'stream_page_load_ms':      ['p(95)<800', 'p(99)<2000'],
    'stream_session_create_ms': ['p(95)<2000'],
    'stream_heartbeat_ms':      ['p(95)<1000'],
    'stream_chat_post_ms':      ['p(95)<1500'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const FAKE_TOKENS = Array.from({ length: 500 }, (_, i) =>
  `eyJfake_load_test_token_${i}_not_real_JWT_sbbl_hq_concurrent_sim}`
);

function pickToken() {
  return FAKE_TOKENS[Math.floor(Math.random() * FAKE_TOKENS.length)];
}

function randomSessionKey() {
  return `load-test-session-${__VU}-${__ITER}-${Date.now()}`;
}

export default function () {
  const vuId = __VU;
  const headers = buildHeaders();

  group('stream_status_poll', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/streams/status`, {
      headers,
      tags: { endpoint: 'stream_status' },
    });
    statusPollTime.add(Date.now() - start);
    errorRate5xx.add(res.status >= 500);

    check(res, {
      'status_poll: 200 OK': (r) => r.status === 200,
      'status_poll: has isLive': (r) => {
        try { return 'isLive' in JSON.parse(r.body); } catch { return false; }
      },
      'status_poll: no 5xx': (r) => r.status < 500,
    });
  });

  sleep(0.1 + Math.random() * 0.4);

  group('live_page_load', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/live`, {
      headers,
      tags: { endpoint: 'live_page' },
    });
    pageLoadTime.add(Date.now() - start);
    errorRate5xx.add(res.status >= 500);

    check(res, {
      'live_page: 200 OK': (r) => r.status === 200,
      'live_page: has CSP header': (r) => (r.headers['Content-Security-Policy'] || '').length > 0,
      'live_page: CSP has s.ytimg.com': (r) =>
        (r.headers['Content-Security-Policy'] || '').includes('s.ytimg.com'),
      'live_page: no 5xx': (r) => r.status < 500,
    });
  });

  sleep(0.2 + Math.random() * 0.8);

  group('playback_session_create', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/streams/${GAME_ID_PROBE}/session`,
      JSON.stringify({ sessionKey: randomSessionKey() }),
      {
        headers: { ...buildHeaders(pickToken()), 'Content-Type': 'application/json' },
        tags: { endpoint: 'session_create' },
      }
    );
    sessionReqTime.add(Date.now() - start);
    errorRate5xx.add(res.status >= 500);

    check(res, {
      'session_create: not 5xx': (r) => r.status < 500,
      'session_create: auth rejection or valid (no crash)': (r) =>
        r.status === 200 || r.status === 401 || r.status === 403,
    });
  });

  sleep(0.5 + Math.random() * 1.5);

  if (vuId % 20 === 0) {
    group('session_heartbeat', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/streams/${GAME_ID_PROBE}/session/heartbeat`,
        JSON.stringify({ sessionId: `fake-session-${vuId}` }),
        {
          headers: { ...buildHeaders(pickToken()), 'Content-Type': 'application/json' },
          tags: { endpoint: 'heartbeat' },
        }
      );
      heartbeatTime.add(Date.now() - start);
      errorRate5xx.add(res.status >= 500);
      check(res, { 'heartbeat: not 5xx': (r) => r.status < 500 });
    });
  }

  if (vuId % 20 < 1) {
    group('chat_post', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/streams/${GAME_ID_PROBE}/comments`,
        JSON.stringify({ message: `Load test message from VU ${vuId} iter ${__ITER}` }),
        {
          headers: { ...buildHeaders(pickToken()), 'Content-Type': 'application/json' },
          tags: { endpoint: 'chat_post' },
        }
      );
      chatPostTime.add(Date.now() - start);
      errorRate5xx.add(res.status >= 500);
      check(res, { 'chat_post: not 5xx': (r) => r.status < 500 });
    });
  }

  if (vuId % 7 === 0) {
    const reactions = ['fire', 'heart', 'clap'];
    const reaction = reactions[vuId % reactions.length];
    group('reaction_post', () => {
      http.post(
        `${BASE_URL}/api/streams/${GAME_ID_PROBE}/react`,
        JSON.stringify({ reaction }),
        {
          headers: { ...buildHeaders(pickToken()), 'Content-Type': 'application/json' },
          tags: { endpoint: 'reaction' },
        }
      );
    });
  }

  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  const thresholds = data.metrics;
  const failed5xx = thresholds['stream_5xx_rate']?.values?.rate ?? 0;
  const p99Status  = thresholds['stream_status_poll_ms']?.values?.['p(99)'] ?? 0;
  const p95Page    = thresholds['stream_page_load_ms']?.values?.['p(95)'] ?? 0;

  const verdict = (
    failed5xx < 0.001 &&
    p99Status < 1500 &&
    p95Page < 800
  ) ? '✅ 10K CONCURRENT: PASS' : '❌ 10K CONCURRENT: FAIL';

  const summary = {
    verdict,
    peak_vus: 10000,
    '5xx_rate': (failed5xx * 100).toFixed(3) + '%',
    'status_poll_p99_ms': Math.round(p99Status),
    'page_load_p95_ms': Math.round(p95Page),
    timestamp: new Date().toISOString(),
  };

  console.log('\n' + JSON.stringify(summary, null, 2));

  return {
    stdout: JSON.stringify(summary, null, 2),
    'artifacts/stream-validation/k6-10k-summary.json': JSON.stringify(data, null, 2),
  };
}
