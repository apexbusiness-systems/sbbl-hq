import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const envPath = 'C:\\Users\\sinyo\\Desktop\\ENV\\SBBL-HQ -ENV.md';
  const envContent = fs.readFileSync(envPath, 'utf8');

  const urlMatch = envContent.match(/SUPABASE_URL=(https:\/\/[^\s]+)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/);

  if (!urlMatch || !keyMatch) {
    console.error('Failed to parse credentials from ENV file.');
    process.exit(1);
  }

  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim(), { auth: { persistSession: false } });
  const targetEmail = 'rondalesteve@gmail.com';

  console.log('=== VERIFYING TARGET PRODUCTION/STAGING DATABASE STATE ===');

  // Check admin_email_grants
  const { data: grants, error: grantsErr } = await supabase
    .from('admin_email_grants')
    .select('*')
    .eq('email', targetEmail);

  if (grantsErr) {
    console.error('Error fetching admin_email_grants:', grantsErr);
  } else {
    console.log('admin_email_grants:', grants);
  }

  // Check auth user and role assignments
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const matchedUser = usersData?.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (matchedUser) {
    console.log('User ID:', matchedUser.id);
    const { data: roles } = await supabase
      .from('user_role_assignments')
      .select('*')
      .eq('user_id', matchedUser.id);
    console.log('user_role_assignments:', roles);
  } else {
    console.log('User not yet registered in auth.users. Trigger trg_auto_grant_role_on_signup is active for signup auto-grant.');
  }
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
