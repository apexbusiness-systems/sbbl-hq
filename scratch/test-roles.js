const correctApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo';
const supabaseUrl = 'https://ezanilxygnpucwkwpsoc.supabase.co';

async function checkRole(email, password, expectedStatus) {
  console.log(`\nTesting user: ${email}`);
  try {
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': correctApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (loginRes.status !== 200) {
      console.log(`Login failed with status ${loginRes.status}. Cannot test role boundary.`);
      return;
    }
    
    const sessionData = await loginRes.json();
    const jwt = sessionData.access_token;
    console.log("Logged in successfully. JWT obtained.");

    const apiRes = await fetch('https://sbbl-hq.icu/api/ops/imports/teams', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    
    console.log(`Hit /ops/imports/teams -> Status: ${apiRes.status}`);
    if (apiRes.status === expectedStatus) {
      console.log(`SUCCESS: Expected ${expectedStatus} and got ${apiRes.status}.`);
    } else {
      console.log(`FAIL: Expected ${expectedStatus} but got ${apiRes.status}.`);
    }

  } catch (e) {
    console.error("Test failed:", e);
  }
}

(async () => {
  await checkRole('qa-stream-user@example.com', 'sb_publishable_5uIVxDWuaI916HXVN9Mb8A_jhrYLPYz', 403);
})();
