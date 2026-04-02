const fs = require('fs');

// Patch tsconfig.app.json
let tsconfig = fs.readFileSync('tsconfig.app.json', 'utf8');
tsconfig = tsconfig.replace(
  `"types": [\n      "vitest/globals"\n    ],`,
  `"types": [\n      "vitest/globals",\n      "node"\n    ],`
);
fs.writeFileSync('tsconfig.app.json', tsconfig);

// Revert fs import
let smokeTest = fs.readFileSync('src/test/migration-smoke.test.ts', 'utf8');
smokeTest = smokeTest.replace(`import { readFileSync } from 'fs';`, `import { readFileSync } from 'node:fs';`);
fs.writeFileSync('src/test/migration-smoke.test.ts', smokeTest);
