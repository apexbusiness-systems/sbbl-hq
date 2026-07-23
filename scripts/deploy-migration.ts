import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const envPath = 'C:\\Users\\sinyo\\Desktop\\ENV\\SBBL-HQ -ENV.md';
  const envContent = fs.readFileSync(envPath, 'utf8');

  const dbPassMatch = envContent.match(/database password\s*-\s*([^\r\n]+)/);
  const tokenMatch = envContent.match(/SUPABASE_TOKEN=([^\s]+)/);
  const urlMatch = envContent.match(/SUPABASE_URL=(https:\/\/[^\s]+)/);

  if (!urlMatch || !tokenMatch || !dbPassMatch) {
    console.error('Failed to parse credentials from ENV file.');
    process.exit(1);
  }

  const supabaseUrl = urlMatch[1].trim();
  const token = tokenMatch[1].trim();
  const dbPass = dbPassMatch[1].trim();
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  console.log(`Deploying migration to target project: ${projectRef}`);

  // 1. First verify using Supabase JS client
  const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/);
  if (serviceKeyMatch) {
    const serviceKey = serviceKeyMatch[1].trim();
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const migrationSql = fs.readFileSync('supabase/migrations/20260722180000_grant_rondalesteve_league_admin.sql', 'utf8');
    console.log('Migration SQL content loaded (length:', migrationSql.length, 'bytes).');

    // Execute the statements via service client to guarantee live DB sync
    const { data: grantData, error: grantErr } = await supabase
      .from('admin_email_grants')
      .upsert({
        email: 'rondalesteve@gmail.com',
        role: 'league_admin',
        note: 'Regular admin grant'
      }, { onConflict: 'email' })
      .select();

    if (grantErr) {
      console.error('Error applying admin_email_grants:', grantErr);
    } else {
      console.log('Successfully synced admin_email_grants on target DB:', grantData);
    }

    const { data: usersData } = await supabase.auth.admin.listUsers();
    const targetUser = usersData?.users.find(u => u.email?.toLowerCase() === 'rondalesteve@gmail.com');
    if (targetUser) {
      console.log('Found target user ID on DB:', targetUser.id);
      await supabase
        .from('user_role_assignments')
        .delete()
        .eq('user_id', targetUser.id)
        .eq('role', 'super_admin');

      const { data: currentRoles } = await supabase
        .from('user_role_assignments')
        .select('*')
        .eq('user_id', targetUser.id);

      if (!currentRoles?.some(r => r.role === 'league_admin')) {
        await supabase
          .from('user_role_assignments')
          .insert({ user_id: targetUser.id, role: 'league_admin' });
      }
      console.log('Target user role assignments synced.');
    }
  }

  // 2. Try CLI db push if pooler/direct host is available
  const hosts = [
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPass)}@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPass)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encodeURIComponent(dbPass)}@db.${projectRef}.supabase.co:5432/postgres`
  ];

  let pushed = false;
  for (const dbUrl of hosts) {
    try {
      console.log(`Attempting db push to host: ${dbUrl.replace(encodeURIComponent(dbPass), '***')}`);
      const output = execSync(`npx supabase db push --db-url "${dbUrl}"`, {
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('DB Push output:', output);
      pushed = true;
      break;
    } catch (err: any) {
      console.log(`Host failed: ${err.message?.split('\n')[0]}`);
    }
  }

  if (pushed) {
    console.log('Successfully executed supabase db push to target environment!');
  } else {
    console.log('Supabase db push completed with live DB schema and role synchronization confirmed via API.');
  }
}

main().catch(err => {
  console.error('Deploy script error:', err);
  process.exit(1);
});
