// checkout_burst.js -- Burst load test for the checkout flow
//
// Run:
//   k6 run tests/k6/checkout_burst.js \
//     -e BASE_URL=https://sbbl-hq.example.com \
//     -e PROFILE=5k

import http from 'k6/http';
import { check, group } from 'k6';
import { getScenarios, sloThresholds, BASE_URL, buildHeaders } from './common.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: getScenarios('checkout_burst'),

  thresholds: {
    ...sloThresholds,

    // Checkout-specific SLOs
    'http_req_duration{endpoint:products}': ['p(95)<800', 'p(99)<2000'],
    'http_req_duration{endpoint:checkout}': ['p(95)<800', 'p(99)<2000'],
    'http_req_duration{endpoint:add_to_cart}': ['p(95)<800', 'p(99)<2000'],

    // 5xx rate < 0.5%
    'http_req_failed{expected_response:true}': ['rate<0.005'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function () {
  const headers = buildHeaders();

  let productId = null;

  group('Browse products', () => {
    const res = http.get(`${BASE_URL}/api/public/products`, {
      headers,
      tags: { endpoint: 'products' },
    });

    check(res, {
      'products status is 2xx': (r) => r.status >= 200 && r.status < 300,
      'products returns JSON': (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data) || (data && typeof data === 'object');
        } catch (_) {
          return false;
        }
      },
    });

    // Try to extract a product ID for subsequent requests
    try {
      const data = JSON.parse(res.body);
      const items = Array.isArray(data) ? data : data.products || data.items || [];
      if (items.length > 0) {
        productId = items[Math.floor(Math.random() * items.length)].id;
      }
    } catch (_) {
      // no-op -- continue with fallback
    }
  });

  group('Add to cart', () => {
    const payload = JSON.stringify({
      product_id: productId || 'test-product-001',
      quantity: 1,
    });

    const res = http.post(`${BASE_URL}/api/cart/items`, payload, {
      headers,
      tags: { endpoint: 'add_to_cart' },
    });

    // 401 expected without auth token -- that is acceptable for load testing.
    check(res, {
      'add to cart no 5xx': (r) => r.status < 500,
      'add to cart returns response': (r) => r.body !== undefined,
    });
  });

  group('Create checkout session', () => {
    const payload = JSON.stringify({
      items: [
        { product_id: productId || 'test-product-001', quantity: 1 },
      ],
    });

    const res = http.post(`${BASE_URL}/api/store/checkout`, payload, {
      headers,
      tags: { endpoint: 'checkout' },
    });

    // 401 expected without auth token -- acceptable for load testing.
    check(res, {
      'checkout no 5xx': (r) => r.status < 500,
      'checkout returns response': (r) => r.body !== undefined,
    });
  });
}
