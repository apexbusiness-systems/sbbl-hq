/**
 * Link the local repo to the Supabase project, then push migrations via the CLI.
 *
 * Usage:
 *   npx tsx scripts/push-via-link.ts
 *
 * Prefer `scripts/deploy-migration.ts` when the project is already linked —
 * this script exists for the first-run / re-link case.
 */

import { execSync } from 'node:child_process';
import { loadSbblCredentials } from './lib/sbbl-env';

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
}

function run(command: string, accessToken: string, label: string) {
  try {
    const output = execSync(command, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`${label} output:`, output);
    return true;
  } catch (err: unknown) {
    const execErr = err as ExecError;
    console.log(`${label} output / note:`, execErr.stdout || execErr.stderr || execErr.message);
    return false;
  }
}

async function main() {
  const creds = loadSbblCredentials();

  // `SUPABASE_ACCESS_TOKEN` is the canonical name. The previous version of this
  // script matched on `SUPABASE_TOKEN=`, which never appears in the ENV file —
  // so it always exited before doing anything.
  if (!creds.accessToken) {
    console.error('Missing SUPABASE_ACCESS_TOKEN — cannot authenticate the Supabase CLI.');
    process.exit(1);
  }
  if (!creds.dbPassword) {
    console.error('Missing database password — set SUPABASE_DB_PASSWORD.');
    process.exit(1);
  }

  console.log(`Linking project ${creds.projectRef}...`);
  run(
    `npx supabase link --project-ref ${creds.projectRef} --password "${creds.dbPassword}"`,
    creds.accessToken,
    'Link'
  );

  console.log('Pushing migrations via CLI...');
  const pushed = run(
    `npx supabase db push --password "${creds.dbPassword}"`,
    creds.accessToken,
    'Push'
  );

  if (!pushed) {
    console.error('❌ Migration push did not complete successfully.');
    process.exit(1);
  }
  console.log('✅ Migrations pushed.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
