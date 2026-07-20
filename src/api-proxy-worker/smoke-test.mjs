// Smoke test for Fix 1 (apikey overwrite) — runs under:
//   node --experimental-strip-types smoke-test.mjs
// No deps, no network. Mocks KV + upstream fetch.
const CLOUD_KEY = 'cloud-anon-key-AAA';
const SELF_KEY = 'selfhost-anon-key-BBB';

const kv = {
  store: new Map([['state', JSON.stringify({ active: 'cloud', failures: 0, lastFailure: 0, lastSwitch: 0, switchCount: 0 })]]),
  async get(k, type) { const v = this.store.get(k) ?? null; return type === 'json' && v ? JSON.parse(v) : v; },
  async put(k, v) { this.store.set(k, v); },
  async delete(k) { this.store.delete(k); },
};

const env = {
  SBBL_BACKEND_STATE: kv,
  SELFHOST_ORIGIN_URL: 'https://selfhost.example',
  CLOUD_URL: 'https://cloud.example',
  CLOUD_ANON_KEY: CLOUD_KEY,
  SELFHOST_ANON_KEY: SELF_KEY,
  FAILOVER_SECRET: 's',
  FAILURE_THRESHOLD: '3',
  FAILURE_WINDOW_MS: '60000',
  UPSTREAM_TIMEOUT_MS: '5000',
  ENVIRONMENT: 'test',
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

let captured;
globalThis.fetch = async (url, init) => {
  captured = { url, headers: new Headers(init.headers) };
  return new Response('{}', { status: 200 });
};

const { default: handler } = await import('./index.ts');
let pass = 0, fail = 0;
const assert = (cond, name) => { cond ? pass++ : (fail++, console.error('FAIL:', name)); };

// 1. Stale (self-host) apikey + anon-echo Authorization → both rewritten to cloud key
await handler.fetch(new Request('https://api.sbbl-hq.icu/auth/v1/token?grant_type=password', {
  method: 'POST', body: '{}',
  headers: { apikey: SELF_KEY, Authorization: `Bearer ${SELF_KEY}` },
}), env, ctx);
assert(captured.url.startsWith('https://cloud.example/'), 'routes to cloud');
assert(captured.headers.get('apikey') === CLOUD_KEY, 'apikey rewritten to cloud key');
assert(captured.headers.get('authorization') === `Bearer ${CLOUD_KEY}`, 'anon Authorization rewritten');

// 2. Genuine session JWT (≠ apikey) → apikey rewritten, Authorization untouched
const sessionJwt = 'Bearer eyJ.session.token';
await handler.fetch(new Request('https://api.sbbl-hq.icu/rest/v1/teams', {
  headers: { apikey: SELF_KEY, Authorization: sessionJwt },
}), env, ctx);
assert(captured.headers.get('apikey') === CLOUD_KEY, 'apikey rewritten (session req)');
assert(captured.headers.get('authorization') === sessionJwt, 'session JWT passes through untouched');

// 3. No headers at all (curl-style) → apikey + anon Authorization injected
await handler.fetch(new Request('https://api.sbbl-hq.icu/rest/v1/teams'), env, ctx);
assert(captured.headers.get('apikey') === CLOUD_KEY, 'apikey injected when absent');
assert(captured.headers.get('authorization') === `Bearer ${CLOUD_KEY}`, 'anon Authorization injected when absent');

// 4. Correct key already present → unchanged, no-op
await handler.fetch(new Request('https://api.sbbl-hq.icu/rest/v1/teams', {
  headers: { apikey: CLOUD_KEY, Authorization: `Bearer ${CLOUD_KEY}` },
}), env, ctx);
assert(captured.headers.get('apikey') === CLOUD_KEY, 'correct apikey preserved');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
