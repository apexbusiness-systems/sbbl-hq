const fs = require('fs');
let code = fs.readFileSync('src/worker/index.ts', 'utf-8');

// handlePlayerCheckout
code = code.replace(
  /async function handlePlayerCheckout\(\{ req, env, admin \}: HandlerCtx\) \{/,
  `async function handlePlayerCheckout({ req, env, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  if (!enforceInMemoryRateLimit(\`player-checkout:\${userId}:\${ip}\`, 6, 60_000)) {
    return json({ ok: false, error: "rate_limit_exceeded" }, 429);
  }`
);
code = code.replace(
  /async function handlePlayerCheckout\(\{ req, env, admin \}: HandlerCtx\) \{\n  const userId = requireAuth\(req\);\n  const ip = req\.headers\.get\("cf-connecting-ip"\) \|\| req\.headers\.get\("x-real-ip"\) \|\| "unknown";\n  if \(\!enforceInMemoryRateLimit\(\`player-checkout:\$\{userId\}:\$\{ip\}\`, 6, 60_000\)\) \{\n    return json\(\{ ok: false, error: "rate_limit_exceeded" \}, 429\);\n  }\n  await ensureMutation\(req, \{ req, env, admin, params: \{\} \}\);\n  const userId = requireAuth\(req\);/,
  `async function handlePlayerCheckout({ req, env, admin }: HandlerCtx) {
  const userId = requireAuth(req);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  if (!enforceInMemoryRateLimit(\`player-checkout:\${userId}:\${ip}\`, 6, 60_000)) {
    return json({ ok: false, error: "rate_limit_exceeded" }, 429);
  }
  await ensureMutation(req, { req, env, admin, params: {} });`
);

// handleDirectStoreCheckout
code = code.replace(
  /async function handleDirectStoreCheckout\(\{ req, env, admin \}: HandlerCtx\) \{/,
  `async function handleDirectStoreCheckout({ req, env, admin }: HandlerCtx) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  if (!enforceInMemoryRateLimit(\`store-checkout:\${ip}\`, 10, 60_000)) {
    return json({ ok: false, error: "rate_limit_exceeded" }, 429);
  }`
);

fs.writeFileSync('src/worker/index.ts', code);
