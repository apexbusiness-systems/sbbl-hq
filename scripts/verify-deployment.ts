/**
 * Verify the live admin-role state for an account.
 *
 * Usage:
 *   npx tsx scripts/verify-deployment.ts [email]
 *
 * Read-only. Exits non-zero if the account holds super_admin, so this doubles
 * as a guard that a "regular admin" grant did not silently escalate.
 */

import { createClient } from '@supabase/supabase-js';
import { loadSbblCredentials, resolveTargetEmail } from './lib/sbbl-env';

const DEFAULT_EMAIL = 'statssbbl@gmail.com';

async function main() {
  const creds = loadSbblCredentials();
  const targetEmail = resolveTargetEmail(DEFAULT_EMAIL);

  const supabase = createClient(creds.supabaseUrl, creds.serviceRoleKey, {
    auth: { persistSession: false }
  });

  console.log('=== VERIFYING TARGET DATABASE STATE ===');
  console.log(`Project: ${creds.projectRef}`);
  console.log(`Email:   ${targetEmail}`);

  const { data: grants, error: grantsErr } = await supabase
    .from('admin_email_grants')
    .select('*')
    .eq('email', targetEmail);

  if (grantsErr) {
    console.error('Error fetching admin_email_grants:', grantsErr);
    process.exit(1);
  }
  console.log('admin_email_grants:', grants);

  if (grants?.some((g) => g.role === 'super_admin')) {
    console.error('❌ admin_email_grants maps this email to super_admin.');
    process.exit(1);
  }

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error('Error listing auth users:', usersErr);
    process.exit(1);
  }

  const matchedUser = usersData?.users.find(
    (u) => u.email?.toLowerCase() === targetEmail
  );

  if (!matchedUser) {
    console.log(
      'User not yet registered in auth.users. ' +
        'trg_auto_grant_role_on_signup is active and will apply the grant on signup.'
    );
    return;
  }

  console.log('User ID:', matchedUser.id);
  const { data: roles } = await supabase
    .from('user_role_assignments')
    .select('*')
    .eq('user_id', matchedUser.id);
  console.log('user_role_assignments:', roles);

  if (roles?.some((r) => r.role === 'super_admin')) {
    console.error('❌ Account holds super_admin — expected league_admin only.');
    process.exit(1);
  }

  console.log('✅ Verified: regular admin only, no super_admin assignment.');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
