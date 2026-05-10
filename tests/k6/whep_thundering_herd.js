/**
 * k6 Load Test — WHEP Thundering Herd Prevention
 *
 * Validates that 50+ concurrent WHEP connections against MediaMTX do NOT
 * cause a thundering herd when exponential backoff + jitter is enabled.
 *
 * What it measures:
 *   - Connection establishment rate under load
 *   - HTTP status distribution (200 vs 429/503)
 *   - Backoff behavior (requests should thin out, not pile up)
 *   - Concurrent viewer session stability
 *
 * Usage:
 *   k6 run tests/k6/whep_thundering_herd.js \
 *     -e WHEP_URL=http://localhost:8889/stream/whep \
 *     -e PROFILE=50
 *
 * Profiles: 50 (default), 100, 200
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────

const WHEP_URL = __ENV.WHEP_URL || 'http://localhost:8889/stream/whep';
const PROFILE = __ENV.PROFILE || '50';

const profiles = {
  '50': {
    executor: 'ramping-vus',
    stages: [
      { duration: '10s', target: 25 },   // ramp to 25
      { duration: '10s', target: 50 },   // ramp to 50
      { duration: '30s', target: 50 },   // sustain 50
      { duration: '10s', target: 0 },    // ramp down
    ],
    gracefulRampDown: '10s',
  },
  '100': {
    executor: 'ramping-vus',
    stages: [
      { duration: '15s', target: 50 },
      { duration: '15s', target: 100 },
      { duration: '60s', target: 100 },
      { duration: '15s', target: 0 },
    ],
    gracefulRampDown: '15s',
  },
  '200': {
    executor: 'ramping-vus',
    stages: [
      { duration: '20s', target: 100 },
      { duration: '20s', target: 200 },
      { duration: '120s', target: 200 },
      { duration: '20s', target: 0 },
    ],
    gracefulRampDown: '20s',
  },
};

const chosenProfile = profiles[PROFILE];
if (!chosenProfile) {
  throw new Error(
    `Unknown PROFILE "${PROFILE}". Choose from: ${Object.keys(profiles).join(', ')}`,
  );
}

export const options = {
  scenarios: {
    whep_viewers: { ...chosenProfile, exec: 'default' },
  },
  thresholds: {
    // Core SLOs
    'http_req_duration{type:whep_offer}': ['p(95)<2000'],     // WHEP negotiation under 2s
    'http_req_failed{type:whep_offer}': ['rate<0.15'],        // <15% failure acceptable under load
    'whep_connection_success': ['rate>0.70'],                 // 70%+ connections succeed
    'whep_429_rate': ['rate<0.30'],                           // <30% rate-limited
    'whep_503_rate': ['rate<0.10'],                           // <10% overloaded
    // Thundering herd detection
    'whep_concurrent_burst': ['max<20'],                      // No burst > 20 simultaneous
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Custom Metrics
// ─────────────────────────────────────────────────────────────────────────

const whepConnectionSuccess = new Rate('whep_connection_success');
const whep429Rate = new Rate('whep_429_rate');
const whep503Rate = new Rate('whep_503_rate');
const whepConcurrentBurst = new Trend('whep_concurrent_burst');
const whepRetryCount = new Counter('whep_retry_count');
const whepNegotiationTime = new Trend('whep_negotiation_time_ms');

// ─────────────────────────────────────────────────────────────────────────
// Exponential Backoff with Jitter (mirrors client implementation)
// ─────────────────────────────────────────────────────────────────────────

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 16000;
const MAX_RETRIES = 5;

function backoffWithJitter(attempt) {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, attempt));
  const jitter = exponential * (0.5 + Math.random() * 0.5);
  return jitter / 1000; // return seconds for k6 sleep()
}

// ─────────────────────────────────────────────────────────────────────────
// Simulated WHEP SDP offer
// ─────────────────────────────────────────────────────────────────────────

const SDP_OFFER = [
  'v=0',
  'o=- 0 0 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=video 9 UDP/TLS/RTP/SAVPF 96',
  'c=IN IP4 0.0.0.0',
  'a=rtcp:9 IN IP4 0.0.0.0',
  'a=ice-ufrag:k6test',
  'a=ice-pwd:k6loadtestpassword123456',
  'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
  'a=setup:actpass',
  'a=mid:0',
  'a=recvonly',
  'a=rtpmap:96 H264/90000',
  '',
].join('\r\n');

// ─────────────────────────────────────────────────────────────────────────
// Main VU Function
// ─────────────────────────────────────────────────────────────────────────

export default function () {
  let connected = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Add jitter before first request to prevent thundering herd
    if (attempt === 0) {
      const initialJitter = Math.random() * 2; // 0-2 seconds
      sleep(initialJitter);
    }

    const start = Date.now();
    const res = http.post(WHEP_URL, SDP_OFFER, {
      headers: {
        'Content-Type': 'application/sdp',
        Accept: 'application/sdp',
      },
      tags: { type: 'whep_offer' },
      timeout: '5s',
    });
    const elapsed = Date.now() - start;
    whepNegotiationTime.add(elapsed);

    // Track concurrent request patterns
    whepConcurrentBurst.add(__VU);

    const is201 = res.status === 201;
    const is200 = res.status === 200;
    const is429 = res.status === 429;
    const is503 = res.status === 503;

    whep429Rate.add(is429);
    whep503Rate.add(is503);

    check(res, {
      'WHEP negotiation succeeded (200/201)': () => is200 || is201,
      'Response has SDP body': () =>
        (is200 || is201) && res.body && res.body.length > 0,
      'No server error (5xx except 503)': () =>
        res.status < 500 || is503,
    });

    if (is200 || is201) {
      connected = true;
      whepConnectionSuccess.add(1);
      break;
    }

    // Rate-limited or overloaded — apply exponential backoff
    if (is429 || is503) {
      whepRetryCount.add(1);
      const delay = backoffWithJitter(attempt);
      sleep(delay);
      continue;
    }

    // Other error — no retry
    whepConnectionSuccess.add(0);
    break;
  }

  if (!connected) {
    whepConnectionSuccess.add(0);
  }

  // Simulate viewer session (watching for 5-15 seconds)
  if (connected) {
    const watchDuration = 5 + Math.random() * 10;
    sleep(watchDuration);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Summary reporter
// ─────────────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    profile: PROFILE,
    whep_url: WHEP_URL,
    connection_success_rate: data.metrics?.whep_connection_success?.values?.rate ?? 'N/A',
    rate_limited_rate: data.metrics?.whep_429_rate?.values?.rate ?? 'N/A',
    overloaded_rate: data.metrics?.whep_503_rate?.values?.rate ?? 'N/A',
    total_retries: data.metrics?.whep_retry_count?.values?.count ?? 0,
    p95_negotiation_ms: data.metrics?.whep_negotiation_time_ms?.values?.['p(95)'] ?? 'N/A',
    thresholds_passed: Object.entries(data.metrics || {}).every(
      ([, m]) => !m.thresholds || Object.values(m.thresholds).every((t) => t.ok),
    ),
  };

  return {
    stdout: `\n━━━ WHEP Thundering Herd Test Summary ━━━\n${JSON.stringify(summary, null, 2)}\n`,
  };
}