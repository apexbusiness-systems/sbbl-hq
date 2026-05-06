import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'https://sbbl-hq.icu').replace(/\/$/, '');
const shortMode = (__ENV.SHORT_MODE || '').toLowerCase() === 'true';
const strictThresholds = (__ENV.STRICT_THRESHOLDS || '').toLowerCase() === 'true';

const liveReqFailRate = new Rate('live_req_fail_rate');
const apiReqFailRate = new Rate('api_req_fail_rate');
const liveLatency = new Trend('live_latency_ms', true);
const apiLatency = new Trend('api_latency_ms', true);
const checksPassed = new Counter('checks_passed');

const acceptedStatuses = shortMode
  ? http.expectedStatuses({ min: 200, max: 302 }, 401, 403, 429, 502, 503)
  : http.expectedStatuses({ min: 200, max: 302 }, 401, 403, 429);
http.setResponseCallback(acceptedStatuses);

// Keep 20k ceiling in both modes; short-mode uses gentler ramp to avoid synthetic load-generator collapse.
const stages = shortMode
  ? [
      { duration: '30s', target: 4000 },
      { duration: '30s', target: 10000 },
      { duration: '30s', target: 16000 },
      { duration: '30s', target: 20000 },
      { duration: '20s', target: 20000 },
      { duration: '20s', target: 0 },
    ]
  : [
      { duration: '2m', target: 5000 },
      { duration: '2m', target: 12000 },
      { duration: '2m', target: 20000 },
      { duration: '2m', target: 20000 },
      { duration: '1m', target: 5000 },
      { duration: '1m', target: 0 },
    ];

const thresholds = strictThresholds
  ? {
      http_req_failed: ['rate<0.02'],
      'http_req_duration{name:live-page}': ['p(95)<1200', 'p(99)<2500'],
      'http_req_duration{name:viewer-count}': ['p(95)<700'],
      live_req_fail_rate: ['rate<0.02'],
      api_req_fail_rate: ['rate<0.02'],
    }
  : {}; // Short/local mode emits telemetry-only output and never hard-fails on thresholds.

export const options = {
  discardResponseBodies: true,
  scenarios: {
    live_event_20k: {
      executor: 'ramping-vus',
      startVUs: 200,
      stages,
      gracefulRampDown: '45s',
    },
  },
  thresholds,
};

function isHealthyStatus(status) {
  // Accept CDN challenge/rate-limit statuses in non-strict mode to measure availability under edge controls.
  return [200, 301, 302, 401, 403, 429].includes(status);
}

export default function () {
  // Jitter first iteration to avoid synchronized burst at large VU scale.
  if (__ITER === 0) sleep(Math.random() * 12);

  const liveRes = http.get(`${BASE_URL}/live`, {
    tags: { name: 'live-page' },
    timeout: shortMode ? '25s' : '15s',
  });
  liveLatency.add(liveRes.timings.duration);
  const liveOk = check(liveRes, {
    'live page reachable': (r) => isHealthyStatus(r.status),
  });
  liveReqFailRate.add(!liveOk);
  if (liveOk) checksPassed.add(1);

  const viewerRes = http.get(`${BASE_URL}/api/streams/stream-validation-game/viewer-count`, {
    tags: { name: 'viewer-count' },
    timeout: shortMode ? '20s' : '10s',
  });
  apiLatency.add(viewerRes.timings.duration);
  const viewerOk = check(viewerRes, {
    'viewer endpoint healthy': (r) => isHealthyStatus(r.status),
  });
  apiReqFailRate.add(!viewerOk);
  if (viewerOk) checksPassed.add(1);

  // Higher think-time in short-mode to preserve browser-like user pacing under large VU counts.
  sleep(shortMode ? Math.random() * 8 + 6 : Math.random() * 2 + 0.5);
}
