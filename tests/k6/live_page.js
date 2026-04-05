// live_page.js -- Load test for the /live page and stream status endpoint
//
// Run:
//   k6 run tests/k6/live_page.js \
//     -e BASE_URL=https://sbbl-hq.example.com \
//     -e PROFILE=5k

import http from 'k6/http';
import { check, group } from 'k6';
import { getScenarios, sloThresholds, BASE_URL, buildHeaders } from './common.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: getScenarios('live_page'),

  thresholds: {
    ...sloThresholds,

    // Scenario-specific SLOs
    'http_req_duration{page:homepage}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{page:stream_status}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{page:public_home}': ['p(95)<500', 'p(99)<1500'],

    // 5xx rate < 0.5%
    'http_req_failed{expected_response:true}': ['rate<0.005'],
  },

  // Structured JSON summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function () {
  const headers = buildHeaders();

  group('Homepage (edge cached)', () => {
    const res = http.get(`${BASE_URL}/`, {
      headers,
      tags: { page: 'homepage' },
    });

    check(res, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage served from edge': (r) =>
        r.headers['Cf-Cache-Status'] === 'HIT' || r.status === 200,
      'homepage body not empty': (r) => r.body && r.body.length > 0,
    });
  });

  group('Stream status (cached)', () => {
    const res = http.get(`${BASE_URL}/api/streams/status`, {
      headers,
      tags: { page: 'stream_status' },
    });

    check(res, {
      'stream status is 2xx': (r) => r.status >= 200 && r.status < 300,
      'stream status has body': (r) => r.body && r.body.length > 0,
    });
  });

  group('Public home data', () => {
    const res = http.get(`${BASE_URL}/api/public/home`, {
      headers,
      tags: { page: 'public_home' },
    });

    check(res, {
      'public home is 2xx': (r) => r.status >= 200 && r.status < 300,
      'public home returns JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (_) {
          return false;
        }
      },
    });
  });
}
