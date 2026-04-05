/**
 * load-live-page.js
 * k6 load test for the SBBL-HQ live basketball event page.
 *
 * Simulates fans hitting the live event page under peak concurrent load:
 *   - GET /live  (main page, Cloudflare edge cached, s-maxage=300)
 *   - GET /api/stream-status  (Worker API, polls for live status)
 *   - GET /rest/v1/standings  (PostgREST, scoreboard/standings query)
 *
 * SLO targets:
 *   - /live p95 latency       < 500ms
 *   - /live p99 latency       < 1500ms
 *   - /live 5xx rate          < 0.5%
 *   - /api/stream-status p95  < 300ms  (CF edge cached)
 *   - /rest/v1 p95 latency    < 600ms
 *
 * Usage:
 *   k6 run \
 *     --env SUPABASE_URL=https://sbbl-hq.icu \
 *     --env ANON_KEY=$(grep ^ANON_KEY .env | cut -d= -f2) \
 *     tests/load-live-page.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// -- Custom metrics ----------------------------------------------------------
const livePageErrors     = new Rate('live_page_errors');
const streamStatusErrors = new Rate('stream_status_errors');
const restErrors         = new Rate('rest_errors');
const livePageDuration   = new Trend('live_page_duration_ms',    true);
const streamStatusDur    = new Trend('stream_status_duration_ms', true);
const restDuration       = new Trend('rest_duration_ms',          true);

// -- Test configuration ------------------------------------------------------
const BASE_URL  = (__ENV.SUPABASE_URL  || 'https://sbbl-hq.icu').replace(/\/$/, '');
const ANON_KEY  = __ENV.ANON_KEY       || '';

export const options = {
  scenarios: {
    // Warm-up + peak load profile matching a live event start
    live_event_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 2000  },  // pre-event ramp
        { duration: '1m',  target: 10000 },  // event start spike
        { duration: '5m',  target: 10000 },  // peak hold (tip-off)
        { duration: '2m',  target: 5000  },  // settling
        { duration: '1m',  target: 0     },  // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // Live page SLOs
    'http_req_duration{name:live-page}':     ['p(95)<500',  'p(99)<1500'],
    'http_req_failed{name:live-page}':       ['rate<0.005'],
    // Stream status SLOs (CF edge cached)
    'http_req_duration{name:stream-status}': ['p(95)<300'],
    'http_req_failed{name:stream-status}':   ['rate<0.005'],
    // PostgREST standings SLOs
    'http_req_duration{name:standings}':     ['p(95)<600'],
    'http_req_failed{name:standings}':       ['rate<0.01'],
    // Custom metric thresholds
    live_page_errors:     ['rate<0.005'],
    stream_status_errors: ['rate<0.005'],
    rest_errors:          ['rate<0.01'],
  },
};

// -- Common headers ----------------------------------------------------------
const anonHeaders = {
  apikey:        ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept:        'application/json',
};

// -- VU function -------------------------------------------------------------
export default function () {
  // 1. Fetch the live event page (HTML, served from CF edge cache)
  group('live-page', () => {
    const res = http.get(`${BASE_URL}/live`, {
      tags:    { name: 'live-page' },
      timeout: '10s',
    });
    livePageDuration.add(res.timings.duration);
    const ok = check(res, {
      'live page status 200':    (r) => r.status === 200,
      'live page has content':   (r) => r.body && r.body.length > 100,
      'live page CF-Cache-Status set': (r) =>
        r.headers['Cf-Cache-Status'] !== undefined ||
        r.headers['cf-cache-status'] !== undefined,
    });
    livePageErrors.add(!ok);
  });

  // 2. Poll the stream status Worker endpoint (CF KV cached)
  group('stream-status', () => {
    const res = http.get(`${BASE_URL}/api/stream-status`, {
      tags:    { name: 'stream-status' },
      timeout: '5s',
    });
    streamStatusDur.add(res.timings.duration);
    const ok = check(res, {
      'stream-status 200 or 304': (r) => r.status === 200 || r.status === 304,
    });
    streamStatusErrors.add(!ok);
  });

  // 3. Fetch standings from PostgREST (DB read, PgBouncer pooled)
  group('standings', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/standings?select=team,wins,losses,points&order=points.desc&limit=20`,
      {
        headers: anonHeaders,
        tags:    { name: 'standings' },
        timeout: '10s',
      }
    );
    restDuration.add(res.timings.duration);
    const ok = check(res, {
      'standings 200':            (r) => r.status === 200,
      'standings is JSON array':  (r) => {
        try { return Array.isArray(JSON.parse(r.body)); }
        catch { return false; }
      },
    });
    restErrors.add(!ok);
  });

  // Simulate realistic user think time between page interactions
  // Real users don't hammer endpoints instantly
  sleep(Math.random() * 3 + 2); // 2-5s think time
}
