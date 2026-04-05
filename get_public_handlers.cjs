const fs = require('fs');

const content = fs.readFileSync('src/worker/index.ts', 'utf-8');

// List of public endpoints without authentication requirement.
const matches = content.match(/async function handle[A-Za-z0-9_]+\(\{ req, admin \}: HandlerCtx\)[^{]*\{[^}]*\}/g) || [];

console.log(matches.length);
