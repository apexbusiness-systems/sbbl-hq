const fs = require('fs');
let code = fs.readFileSync('src/worker/index.ts', 'utf-8');

const replacement = `function enforceInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();

  // Sweep stale rate limits to prevent OOM under extreme load (20k+ concurrents)
  // Run sweep approx 10% of the time to avoid CPU block
  if (Math.random() < 0.1) {
    for (const [k, v] of transientRateLimits.entries()) {
      const valid = v.filter((ts) => now - ts <= windowMs);
      if (valid.length === 0) transientRateLimits.delete(k);
      else transientRateLimits.set(k, valid);
    }

    // Also sweep idempotency map which grows unbounded
    for (const [k, v] of transientIdempotency.entries()) {
       if (now - v > 60_000) transientIdempotency.delete(k);
    }
  }

  const bucket = transientRateLimits.get(key) ?? [];
  const recent = bucket.filter((ts) => now - ts <= windowMs);
  if (recent.length >= limit) {
    transientRateLimits.set(key, recent);
    return false;
  }
  recent.push(now);
  transientRateLimits.set(key, recent);
  return true;
}`;

code = code.replace(
  /function enforceInMemoryRateLimit\([\s\S]*?return true;\n\}/,
  replacement
);

fs.writeFileSync('src/worker/index.ts', code);
