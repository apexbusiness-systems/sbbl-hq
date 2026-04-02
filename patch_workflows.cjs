const fs = require('fs');

const ciFile = '.github/workflows/ci.yml';
let ciCode = fs.readFileSync(ciFile, 'utf8');

ciCode = ciCode.replace(
  /      - uses: actions\/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm/g,
  `      - uses: oven-sh/setup-bun@v1\n        with:\n          bun-version: latest`
);

ciCode = ciCode.replace(/npm ci/g, 'bun install');
ciCode = ciCode.replace(/npm run lint/g, 'bun run lint');
ciCode = ciCode.replace(/npm run typecheck/g, 'bun run typecheck');
ciCode = ciCode.replace(/npm test/g, 'bun test');
ciCode = ciCode.replace(/npm run build/g, 'bun run build');

fs.writeFileSync(ciFile, ciCode);

const e2eFile = '.github/workflows/playwright-e2e.yml';
let e2eCode = fs.readFileSync(e2eFile, 'utf8');

e2eCode = e2eCode.replace(
  /      - name: Setup Node\n        uses: actions\/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm/g,
  `      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1\n        with:\n          bun-version: latest`
);

e2eCode = e2eCode.replace(/npm ci/g, 'bun install');

fs.writeFileSync(e2eFile, e2eCode);
