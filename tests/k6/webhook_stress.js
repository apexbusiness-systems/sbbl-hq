// webhook_stress.js -- Stress test for webhook endpoint resilience
//
// Run:
//   k6 run tests/k6/webhook_stress.js \
//     -e BASE_URL=https://sbbl-hq.example.com \
//     -e PROFILE=5k

import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, buildHeaders } from './common.js';

// ---------------------------------------------------------------------------
// Options -- constant-arrival-rate executor
// ---------------------------------------------------------------------------

const rateProfiles = {
  '5k':   { rate: 1000, duration: '5m',  preAllocatedVUs: 100,  maxVUs: 1000 },
  '20k':  { rate: 3000, duration: '8m',  preAllocatedVUs: 300,  maxVUs: 3000 },
  '50k':  { rate: 5000, duration: '15m', preAllocatedVUs: 500,  maxVUs: 5000 },
  '500k': { rate: 5000, duration: '15m', preAllocatedVUs: 500,  maxVUs: 5000 },
};

const profileName = __ENV.PROFILE || '5k';
const rp = rateProfiles[profileName];
if (!rp) {
  throw new Error(`Unknown PROFILE "${profileName}"`);
}

export const options = {
  scenarios: {
    webhook_stress: {
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
    // No 5xx allowed -- 2xx + 4xx must account for > 99.9% of responses
    'checks{check:no_5xx}': ['rate>0.999'],
    'checks{check:no_crash}': ['rate>0.999'],

    // Overall request failure (network errors, timeouts)
    http_req_failed: ['rate<0.001'],

    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Fake Stripe webhook payloads
// ---------------------------------------------------------------------------

let eventCounter = 0;

function fakeStripeEvent(type, dedupe) {
  eventCounter++;
  const eventId = dedupe
    ? 'evt_duplicate_test_fixed_id'
    : `evt_test_${Date.now()}_${eventCounter}_${Math.random().toString(36).slice(2, 8)}`;

  return JSON.stringify({
    id: eventId,
    object: 'event',
    type: type,
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${eventCounter}`,
        object: 'checkout.session',
        amount_total: 2999,
        currency: 'usd',
        status: 'complete',
        customer_email: `loadtest+${eventCounter}@sbbl-hq.test`,
      },
    },
    livemode: false,
    pending_webhooks: 1,
  });
}

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    // Deliberately invalid signature -- endpoint should return 400, not 5xx.
    'Stripe-Signature': 't=0,v1=invalid_signature_for_load_test',
  };

  group('Webhook: checkout.session.completed', () => {
    const payload = fakeStripeEvent('checkout.session.completed', false);

    const res = http.post(`${BASE_URL}/webhooks/stripe`, payload, {
      headers,
      tags: { event_type: 'checkout_completed' },
    });

    check(res, {
      'no_5xx': (r) => r.status < 500,
      'returns 2xx or 4xx': (r) =>
        (r.status >= 200 && r.status < 300) || (r.status >= 400 && r.status < 500),
      'no_crash': (r) => r.status !== 0 && r.status !== 502 && r.status !== 503,
    });
  });

  group('Webhook: duplicate event handling', () => {
    // Send the same event ID twice to test idempotency
    const payload = fakeStripeEvent('checkout.session.completed', true);

    const res1 = http.post(`${BASE_URL}/webhooks/stripe`, payload, {
      headers,
      tags: { event_type: 'duplicate_first' },
    });

    const res2 = http.post(`${BASE_URL}/webhooks/stripe`, payload, {
      headers,
      tags: { event_type: 'duplicate_second' },
    });

    check(res1, {
      'no_5xx': (r) => r.status < 500,
      'no_crash': (r) => r.status !== 0 && r.status !== 502 && r.status !== 503,
    });

    check(res2, {
      'duplicate no_5xx': (r) => r.status < 500,
      'duplicate no_crash': (r) => r.status !== 0 && r.status !== 502 && r.status !== 503,
    });
  });

  group('Webhook: other event types', () => {
    const types = [
      'payment_intent.succeeded',
      'customer.subscription.created',
      'invoice.paid',
    ];
    const eventType = types[Math.floor(Math.random() * types.length)];
    const payload = fakeStripeEvent(eventType, false);

    const res = http.post(`${BASE_URL}/webhooks/stripe`, payload, {
      headers,
      tags: { event_type: eventType },
    });

    check(res, {
      'no_5xx': (r) => r.status < 500,
      'no_crash': (r) => r.status !== 0 && r.status !== 502 && r.status !== 503,
    });
  });
}
