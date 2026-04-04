const fs = require('fs');
const file = 'src/worker/index.ts';
let code = fs.readFileSync(file, 'utf8');

const cleanup = `  // Cleanup old keys
  for (const [k, t] of transientIdempotency.entries()) {
    if (now - t > 60000) {
      transientIdempotency.delete(k);
    }
  }

  const seenAt = transientIdempotency.get(key);`;

code = code.replace('  const seenAt = transientIdempotency.get(key);', cleanup);
fs.writeFileSync(file, code);
