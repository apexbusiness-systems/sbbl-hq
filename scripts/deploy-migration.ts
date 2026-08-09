/**
 * Push pending Supabase migrations to the linked project.
 *
 * Usage:
 *   npx tsx scripts/deploy-migration.ts
 *
 * Tries the regional poolers before the direct host, because the direct
 * `db.<ref>.supabase.co:5432` endpoint is frequently unreachable from
 * workstations behind IPv4-only networks.
 *
 * NOTE: This script no longer inlines any account-specific role grant. Role
 * changes live in their own migration and in `scripts/grant-regular-admin.ts`;
 * duplicating them here is what let the two paths drift apart previously.
 */

import { execSync } from 'node:child_process';
import { loadSbblCredentials } from './lib/sbbl-env';

function candidateDbUrls(projectRef: string, password: string): string[] {
  const pw = encodeURIComponent(password);
  return [
    `postgresql://postgres.${projectRef}:${pw}@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${pw}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${pw}@db.${projectRef}.supabase.co:5432/postgres`
  ];
}

async function main() {
  const creds = loadSbblCredentials();

  if (!creds.dbPassword) {
    console.error(
      'Missing database password. Set SUPABASE_DB_PASSWORD, or provide it in the operator ENV file.'
    );
    process.exit(1);
  }

  console.log(`Deploying migrations to project: ${creds.projectRef}`);

  for (const dbUrl of candidateDbUrls(creds.projectRef, creds.dbPassword)) {
    const redacted = dbUrl.replace(encodeURIComponent(creds.dbPassword), '***');
    console.log(`Attempting db push via: ${redacted}`);
    try {
      const output = execSync(`npx supabase db push --db-url "${dbUrl}"`, {
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: creds.accessToken ?? '' },
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('DB push output:', output);
      console.log('✅ Migrations pushed successfully.');
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Host failed: ${message.split('\n')[0]}`);
    }
  }

  console.error('❌ All candidate database hosts failed. Migrations were NOT pushed.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Deploy script error:', err);
  process.exit(1);
});
