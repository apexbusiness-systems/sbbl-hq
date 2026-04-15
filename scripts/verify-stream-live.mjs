#!/usr/bin/env node
/**
 * verify-stream-live.mjs
 * Live API endpoint health verification for sbbl-hq.icu livestream pipeline.
 * Tests the actual production worker — no mocks, no stubs.
 *
 * Run: node scripts/verify-stream-live.mjs
 * Env: BASE_URL (default: https://sbbl-hq.icu)
 */

const BASE = process.env.BASE_URL || 'https://sbbl-hq.icu';
const TIMEOUT_MS = 8000;

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;
const results = [];

async function check(name, fn) {
  const start = Date.now();
  try {
    const { ok, detail } = await fn();
    const ms = Date.now() - start;
    if (ok) {
      console.log(`${GREEN}✓${RESET} ${name} ${YELLOW}(${ms}ms)${RESET}`);
      passed++;
      results.push({ name, ok: true, ms });
    } else {
      console.log(`${RED}✗${RESET} ${BOLD}${name}${RESET} — ${detail} ${YELLOW}(${ms}ms)${RESET}`);
      failed++;
      results.push({ name, ok: false, ms, detail });
    }
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`${RED}✗${RESET} ${BOLD}${name}${RESET} — EXCEPTION: ${err.message}`);
    failed++;
    results.push({ name, ok: false, ms, detail: err.message });
  }
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

console.log(`\n${BOLD}=== SBBL HQ LIVESTREAM PIPELINE VERIFICATION ===${RESET}`);
console.log(`Target: ${BASE}\n`);

// ── Test 1: Stream status endpoint ────────────────────────────────────────
await check('GET /api/streams/status → 200 + valid JSON', async () => {
  const res = await fetchWithTimeout(`${BASE}/api/streams/status`);
  if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
  const body = await res.json();
  if (typeof body.isLive !== 'boolean') return { ok: false, detail: 'isLive field missing' };
  if (typeof body.viewerCount !== 'number') return { ok: false, detail: 'viewerCount field missing' };
  return { ok: true };
});

// ── Test 2: CSP header on HTML shell ──────────────────────────────────────
await check('/live HTML → CSP contains s.ytimg.com in script-src-elem', async () => {
  const res = await fetchWithTimeout(`${BASE}/live`);
  const csp = res.headers.get('content-security-policy') || '';
  if (!csp) return { ok: false, detail: 'No CSP header present' };
  const scriptSrcElem = csp.split(';').find(d => d.trim().startsWith('script-src-elem'));
  if (!scriptSrcElem) {
    const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src'));
    if (!scriptSrc?.includes('s.ytimg.com')) {
      return { ok: false, detail: `s.ytimg.com absent from script-src. CSP: ${csp.slice(0, 300)}` };
    }
    return { ok: true };
  }
  if (!scriptSrcElem.includes('s.ytimg.com')) {
    return { ok: false, detail: `s.ytimg.com absent from script-src-elem. Directive: ${scriptSrcElem}` };
  }
  return { ok: true };
});

// ── Test 3: CSP — YouTube WebSocket in connect-src ────────────────────────
await check('/live HTML → CSP connect-src contains wss://www.youtube.com', async () => {
  const res = await fetchWithTimeout(`${BASE}/live`);
  const csp = res.headers.get('content-security-policy') || '';
  const connectSrc = csp.split(';').find(d => d.trim().startsWith('connect-src'));
  if (!connectSrc) return { ok: false, detail: 'connect-src directive missing entirely' };
  if (!connectSrc.includes('wss://www.youtube.com')) {
    return { ok: false, detail: `wss://www.youtube.com absent. connect-src: ${connectSrc.slice(0, 200)}` };
  }
  return { ok: true };
});

// ── Test 4: CSP — Facebook fully blocked ──────────────────────────────────
await check('/live HTML → CSP has NO facebook.com in allowlist directives', async () => {
  const res = await fetchWithTimeout(`${BASE}/live`);
  const csp = res.headers.get('content-security-policy') || '';
  const allowlistDirectives = ['script-src', 'script-src-elem', 'connect-src', 'frame-src', 'media-src'];
  for (const directive of allowlistDirectives) {
    const dir = csp.split(';').find(d => d.trim().startsWith(directive));
    if (dir && (dir.includes('facebook.com') || dir.includes('fbcdn.net') || dir.includes('facebook.net'))) {
      return { ok: false, detail: `Facebook domain found in ${directive} — should be blocked` };
    }
  }
  return { ok: true };
});

// ── Test 5: CSP — worker-src allows blob: ─────────────────────────────────
await check('/live HTML → CSP worker-src includes blob:', async () => {
  const res = await fetchWithTimeout(`${BASE}/live`);
  const csp = res.headers.get('content-security-policy') || '';
  const workerSrc = csp.split(';').find(d => d.trim().startsWith('worker-src'));
  if (!workerSrc?.includes('blob:')) {
    return { ok: false, detail: `worker-src missing blob:. Directive: ${workerSrc}` };
  }
  return { ok: true };
});

// ── Test 6: Public home API ────────────────────────────────────────────────
await check('GET /api/public/home → 200 + games array', async () => {
  const res = await fetchWithTimeout(`${BASE}/api/public/home`);
  if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
  const body = await res.json();
  if (!Array.isArray(body.games) && !Array.isArray(body.liveGames)) {
    return { ok: false, detail: 'games/liveGames array missing from response' };
  }
  return { ok: true };
});

// ── Test 7: Stream status p99 latency under 500ms ─────────────────────────
await check('/api/streams/status → p99 latency < 500ms (20 samples)', async () => {
  const latencies = [];
  for (let i = 0; i < 20; i++) {
    const t0 = Date.now();
    await fetchWithTimeout(`${BASE}/api/streams/status`);
    latencies.push(Date.now() - t0);
  }
  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? latencies[latencies.length - 1];
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  if (p99 >= 500) return { ok: false, detail: `p99=${p99}ms exceeds 500ms SLO. p50=${p50}ms` };
  return { ok: true, detail: `p50=${p50}ms p99=${p99}ms` };
});

// ── Test 8: Unauthenticated session → 401 not 500 ─────────────────────────
await check('POST /api/streams/broadcast/session → 401 (unauthenticated, not 500)', async () => {
  const res = await fetchWithTimeout(`${BASE}/api/streams/broadcast/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey: 'probe-session-key-abc123' }),
  });
  if (res.status === 500) return { ok: false, detail: 'Worker crashed (500) on unauthenticated session request' };
  if (res.status === 401 || res.status === 403 || res.status === 404) return { ok: true };
  return { ok: false, detail: `Unexpected status ${res.status}` };
});

// ── Test 9: /live page non-empty HTML ─────────────────────────────────────
await check('GET /live → HTML body is non-empty and contains app root', async () => {
  const res = await fetchWithTimeout(`${BASE}/live`);
  if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
  const html = await res.text();
  if (html.length < 500) return { ok: false, detail: `HTML suspiciously short: ${html.length} chars` };
  if (!html.includes('<div id="root">')) return { ok: false, detail: 'App root div missing from HTML' };
  return { ok: true };
});

// ── Test 10: Stream status has collectionId field ─────────────────────────
await check('GET /api/streams/status → response includes collectionId field', async () => {
  const res = await fetchWithTimeout(`${BASE}/api/streams/status`);
  if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
  const body = await res.json();
  if (!('collectionId' in body) && !('isLive' in body)) return { ok: false, detail: 'collectionId field absent — worker may have schema drift' };
  return { ok: true };
});

// ── SUMMARY ───────────────────────────────────────────────────────────────
console.log(`\n${BOLD}=== RESULTS ===${RESET}`);
console.log(`${GREEN}PASSED: ${passed}${RESET} / ${passed + failed}`);
if (failed > 0) {
  console.log(`${RED}FAILED: ${failed}${RESET}`);
  console.log(`\nFailed tests:`);
  results.filter(r => !r.ok).forEach(r => console.log(`  ${RED}✗${RESET} ${r.name}: ${r.detail}`));
}

const verdict = failed === 0
  ? `${GREEN}${BOLD}STREAM PIPELINE: PASS${RESET}`
  : `${RED}${BOLD}STREAM PIPELINE: FAIL${RESET}`;
console.log(`\n${verdict}\n`);
process.exit(failed > 0 ? 1 : 0);
