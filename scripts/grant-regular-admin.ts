/**
 * Grant REGULAR admin (league_admin) to an account — never super_admin.
 *
 * Usage:
 *   npx tsx scripts/grant-regular-admin.ts [email]
 *   ADMIN_EMAIL=someone@example.com npx tsx scripts/grant-regular-admin.ts
 *
 * Defaults to statssbbl@gmail.com (see
 * supabase/migrations/20260809120000_grant_statssbbl_league_admin.sql).
 *
 * The migration is the source of truth; this script is the operator path for
 * applying the same change to a live project without a full `db push`.
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

  console.log(`Project: ${creds.projectRef}`);
  console.log(`Setting regular admin (league_admin) status for: ${targetEmail}`);

  // 1. Upsert admin_email_grants. The UPDATE branch is what performs a
  //    downgrade when the email was previously mapped to super_admin.
  const { data: grantData, error: grantError } = await supabase
    .from('admin_email_grants')
    .upsert(
      {
        email: targetEmail,
        role: 'league_admin',
        note: 'Regular admin grant — league stats operator (NOT super admin)'
      },
      { onConflict: 'email' }
    )
    .select();

  if (grantError) {
    console.error('Error upserting admin_email_grants:', grantError);
    process.exit(1);
  }
  console.log('Successfully updated admin_email_grants:', grantData);

  // 2. Reconcile role assignments for an already-registered user.
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Error fetching auth users:', usersError);
    process.exit(1);
  }

  const matchedUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === targetEmail
  );

  if (!matchedUser) {
    console.log(
      'No existing auth user found for this email. ' +
        'league_admin will be auto-granted on signup via trg_auto_grant_role_on_signup.'
    );
  } else {
    console.log(`Found auth user ID: ${matchedUser.id}`);

    // Revoke super_admin BEFORE granting league_admin so a downgrade is never
    // a partial state where the account briefly holds both.
    const { error: revokeError } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', matchedUser.id)
      .eq('role', 'super_admin');

    if (revokeError) {
      console.error('Error revoking super_admin role:', revokeError);
      process.exit(1);
    }
    console.log('Revoked super_admin role assignment if present.');

    const { data: existingRoles, error: rolesError } = await supabase
      .from('user_role_assignments')
      .select('*')
      .eq('user_id', matchedUser.id);

    if (rolesError) {
      console.error('Error fetching user_role_assignments:', rolesError);
      process.exit(1);
    }

    if (existingRoles.some((r) => r.role === 'league_admin')) {
      console.log('User already has league_admin role in user_role_assignments.');
    } else {
      const { data: insertedRole, error: insertError } = await supabase
        .from('user_role_assignments')
        .insert({ user_id: matchedUser.id, role: 'league_admin' })
        .select();

      if (insertError) {
        console.error('Error inserting league_admin role:', insertError);
        process.exit(1);
      }
      console.log('Inserted league_admin role in user_role_assignments:', insertedRole);
    }
  }

  // 3. Verification — print the settled state so the run is self-evidencing.
  const { data: verifyGrant } = await supabase
    .from('admin_email_grants')
    .select('email, role, note, created_at')
    .eq('email', targetEmail);

  console.log('FINAL admin_email_grants state:', verifyGrant);

  if (matchedUser) {
    const { data: verifyRoles } = await supabase
      .from('user_role_assignments')
      .select('user_id, role, created_at')
      .eq('user_id', matchedUser.id);
    console.log('FINAL user_role_assignments state for user:', verifyRoles);

    if (verifyRoles?.some((r) => r.role === 'super_admin')) {
      console.error('❌ super_admin still present after revoke — investigate.');
      process.exit(1);
    }
  }

  console.log('✅ Regular admin (league_admin) grant complete.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
