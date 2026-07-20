import { test, expect } from '@playwright/test';

test('Task 5 live stream verification', async ({ page }) => {
  test.setTimeout(90000);
  const requests: string[] = [];
  
  const correctApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo';
  const supabaseUrl = 'https://ezanilxygnpucwkwpsoc.supabase.co';

  console.log('Logging in via REST...');
  const email = 'jrmendozaceo@apexbusiness-systems.com';
  const password = 'Apex143!';
  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 
      'apikey': correctApiKey, 
      'Authorization': `Bearer ${correctApiKey}`,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ email, password })
  });
  const sessionData = await loginRes.json();
  console.log("Session user ID:", sessionData.user?.id);

  if (sessionData.error) {
     console.error("Login failed:", sessionData);
  }

  // Inject into local storage
  await page.addInitScript(({ sessionData }) => {
     if (sessionData && sessionData.access_token) {
       window.localStorage.setItem('sb-ezanilxygnpucwkwpsoc-auth-token', JSON.stringify(sessionData));
     }
  }, { sessionData });

  await page.route('https://ezanilxygnpucwkwpsoc.supabase.co/**', async route => {
    const headers = route.request().headers();
    headers['apikey'] = correctApiKey;
    if (headers['authorization'] && headers['authorization'].length < 200) {
       headers['authorization'] = `Bearer ${correctApiKey}`;
    }
    await route.continue({ headers });
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('.m3u8') || url.includes('.ts') || url.includes('whep') || url.includes('facebook.com/plugins/video.php')) {
      requests.push(`[${new Date().toISOString()}] ${response.status()} ${url.substring(0, 100)}...`);
    }
  });

  console.log('Navigating to /live...');
  await page.goto('https://sbbl-hq.icu/live', { waitUntil: 'domcontentloaded' });
  
  await page.waitForTimeout(5000); // Give the player time to mount
  
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT SNIPPET:', pageText.substring(0, 200).replace(/\n/g, ' '));
  
  const iframes = await page.locator('iframe').evaluateAll(iframes => iframes.map(i => i.src));
  console.log('IFRAMES FOUND:', iframes);
  
  console.log('Taking screenshot 1...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_1.png' });
  
  await page.waitForTimeout(15000);
  console.log('Taking screenshot 2...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_2.png' });
  
  await page.waitForTimeout(15000);
  console.log('Taking screenshot 3...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_3.png' });

  console.log('--- NETWORK LOG (Media/Streaming) ---');
  requests.forEach(r => console.log(r));
  console.log('Done.');
});
