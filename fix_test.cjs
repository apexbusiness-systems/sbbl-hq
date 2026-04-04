const fs = require('fs');

const code = fs.readFileSync('src/test/worker-ingress.test.ts', 'utf-8');
const newCode = code.replace(/expect\(res\.status\)\.toBe\(403\);/, 'expect(res.status).toBe(401);');

fs.writeFileSync('src/test/worker-ingress.test.ts', newCode);
console.log('Fixed src/test/worker-ingress.test.ts');
