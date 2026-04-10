import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), 'supabase/config.toml');
let content = readFileSync(configPath, 'utf-8');

content = content.replace(
  '\n# Prevent leaked passwords (HaveIBeenPwned) in environments where this auth setting is supported.\npassword_hibp_enabled = true\n',
  '\n',
);

content = content.replace(/\npassword_hibp_enabled\s*=\s*true\s*\n/g, '\n');

writeFileSync(configPath, content);
