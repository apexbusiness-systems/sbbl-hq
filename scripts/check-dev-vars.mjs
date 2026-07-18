import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const devVarsPath = path.join(rootDir, '.dev.vars');

if (!fs.existsSync(devVarsPath)) {
  console.error('🚨 ERROR: .dev.vars file is missing in the project root.');
  console.error('This file is required for local development to prevent committing real secrets to wrangler.jsonc.');
  console.error('Please create .dev.vars and add SUPABASE_PUBLISHABLE_KEY and other required secrets.');
  process.exit(1);
}

const content = fs.readFileSync(devVarsPath, 'utf8');
if (!content.includes('SUPABASE_PUBLISHABLE_KEY')) {
  console.error('🚨 ERROR: .dev.vars is missing SUPABASE_PUBLISHABLE_KEY.');
  console.error('Local worker dev server requires this to avoid auth split-brain.');
  process.exit(1);
}

console.log('✅ Preflight dev check passed: .dev.vars exists and contains required secrets.');
