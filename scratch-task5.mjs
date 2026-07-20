import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ezanilxygnpucwkwpsoc.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Logging in as super_admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jrmendozaceo@apexbusiness-systems.com',
    password: 'Apex143!'
  });

  if (authError) {
    console.error('Login failed:', authError.message);
    process.exit(1);
  }

  console.log('Logged in successfully. User ID:', authData.user.id);

  // Get a test user (we can grab any non-super admin user or create one)
  const throwawayEmail = `test-league-admin-${Date.now()}@example.com`;
  console.log(`Creating throwaway account: ${throwawayEmail}`);
  
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: throwawayEmail,
    password: 'password123'
  });

  if (signupError) {
    console.error('Signup failed:', signupError.message);
    process.exit(1);
  }

  const throwawayId = signupData.user.id;
  console.log(`Throwaway account created. User ID: ${throwawayId}`);

  console.log('Inserting league_admin role assignment...');
  const { error: insertError } = await supabase
    .from('user_role_assignments')
    .insert({ user_id: throwawayId, role: 'league_admin' });

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    process.exit(1);
  }

  console.log('Successfully inserted league_admin role.');

  // Now verify the 403 vs 200 via the API proxy or direct fetch
  console.log('Validating boundaries on /api/ops/imports/teams...');
  
  // 1. super_admin test
  const adminRes = await fetch('https://sbbl-hq.icu/api/ops/imports/teams', {
    headers: { 'Authorization': `Bearer ${authData.session.access_token}` }
  });
  console.log(`super_admin request status: ${adminRes.status}`);

  // 2. league_admin test
  const leagueAdminRes = await fetch('https://sbbl-hq.icu/api/ops/imports/teams', {
    headers: { 'Authorization': `Bearer ${signupData.session.access_token}` }
  });
  console.log(`league_admin request status: ${leagueAdminRes.status}`);
}

main().catch(console.error);
