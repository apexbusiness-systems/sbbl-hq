import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const envPath = 'C:\\Users\\sinyo\\Desktop\\ENV\\SBBL-HQ -ENV.md';
  const envContent = fs.readFileSync(envPath, 'utf8');

  const urlMatch = envContent.match(/SUPABASE_URL=(https:\/\/[^\s]+)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/);

  if (!urlMatch || !keyMatch) {
    console.error('Failed to extract Supabase credentials from ENV file.');
    process.exit(1);
  }

  const supabaseUrl = urlMatch[1].trim();
  const serviceRoleKey = keyMatch[1].trim();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const targetEmail = 'rondalesteve@gmail.com';

  console.log(`Setting regular admin (league_admin) status for: ${targetEmail}`);

  // 1. Upsert admin_email_grants
  const { data: grantData, error: grantError } = await supabase
    .from('admin_email_grants')
    .upsert(
      {
        email: targetEmail,
        role: 'league_admin',
        note: 'Regular admin grant'
      },
      { onConflict: 'email' }
    )
    .select();

  if (grantError) {
    console.error('Error upserting admin_email_grants:', grantError);
    process.exit(1);
  }
  console.log('Successfully updated admin_email_grants:', grantData);

  // 2. Check auth.users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Error fetching auth users:', usersError);
  } else {
    const matchedUser = usersData.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (matchedUser) {
      console.log(`Found auth user ID: ${matchedUser.id}`);

      // Revoke super_admin if present
      const { error: revokeError } = await supabase
        .from('user_role_assignments')
        .delete()
        .eq('user_id', matchedUser.id)
        .eq('role', 'super_admin');

      if (revokeError) {
        console.error('Error revoking super_admin role:', revokeError);
      } else {
        console.log('Revoked super_admin role assignment if present.');
      }

      // Check existing roles for user
      const { data: existingRoles, error: rolesError } = await supabase
        .from('user_role_assignments')
        .select('*')
        .eq('user_id', matchedUser.id);

      if (rolesError) {
        console.error('Error fetching user_role_assignments:', rolesError);
      } else {
        const hasLeagueAdmin = existingRoles.some(r => r.role === 'league_admin');
        if (!hasLeagueAdmin) {
          const { data: insertedRole, error: insertError } = await supabase
            .from('user_role_assignments')
            .insert({
              user_id: matchedUser.id,
              role: 'league_admin'
            })
            .select();

          if (insertError) {
            console.error('Error inserting league_admin role:', insertError);
          } else {
            console.log('Inserted league_admin role in user_role_assignments:', insertedRole);
          }
        } else {
          console.log('User already has league_admin role in user_role_assignments.');
        }
      }
    } else {
      console.log('No existing auth user found for this email. Role will be auto-granted upon signup via trigger.');
    }
  }

  // 3. Verification step
  const { data: verifyGrant } = await supabase
    .from('admin_email_grants')
    .select('email, role, note, created_at')
    .eq('email', targetEmail);

  console.log('FINAL admin_email_grants state:', verifyGrant);

  if (usersData?.users) {
    const matchedUser = usersData.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (matchedUser) {
      const { data: verifyRoles } = await supabase
        .from('user_role_assignments')
        .select('user_id, role, created_at')
        .eq('user_id', matchedUser.id);
      console.log('FINAL user_role_assignments state for user:', verifyRoles);
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
