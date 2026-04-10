import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const wranglerPath = resolve(root, 'wrangler.jsonc');
const packagePath = resolve(root, 'package.json');

function patchWrangler() {
  let content = readFileSync(wranglerPath, 'utf-8');

  content = content.replace('"main": "src/worker/index.ts"', '"main": "src/worker/validation-contract-wrapper.ts"');

  if (!content.includes('"ENABLE_STREAM_VALIDATION"')) {
    content = content.replace(
      '"SENTRY_DSN": ""',
      '"SENTRY_DSN": "",\n    "ENABLE_STREAM_VALIDATION": "false"',
    );
  }

  writeFileSync(wranglerPath, content);
}

function patchPackage() {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  pkg.scripts = pkg.scripts ?? {};

  pkg.scripts['test:stream:unit'] = 'node ops/validation/stream-validation.mjs unit';
  pkg.scripts['test:stream:int'] = 'node ops/validation/stream-validation.mjs int';
  pkg.scripts['test:stream:e2e'] = 'node ops/validation/stream-validation.mjs e2e';
  pkg.scripts['test:stream:perf'] = 'node ops/validation/stream-validation.mjs perf';
  pkg.scripts['test:stream:all'] = 'npm run test:stream:unit && npm run test:stream:int && npm run test:stream:e2e && npm run test:stream:perf';
  pkg.scripts['validate:stream:gate'] = 'node ops/validation/stream-validation.mjs gate';
  pkg.scripts['validate:prelive'] = 'node ops/validation/stream-validation.mjs prelive';

  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

patchWrangler();
patchPackage();
