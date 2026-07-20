const correctApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo';
const supabaseUrl = 'https://ezanilxygnpucwkwpsoc.supabase.co';

(async () => {
  const email = `throwaway-${Date.now()}@apexbusiness-systems.com`;
  const password = 'TestPass123!';
  console.log("Attempting signup...");
  try {
    const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { 
        'apikey': correctApiKey, 
        'Authorization': `Bearer ${correctApiKey}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email, password })
    });
    const text = await signupRes.text();
    console.log("Status:", signupRes.status);
    console.log("Response:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
})();
