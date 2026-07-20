import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('https://sbbl-hq.icu/login');

    console.log('Filling in credentials...');
    await page.fill('input[type="email"]', 'gamepointagent@gmail.com');
    await page.fill('input[type="password"]', 'Apex143!');
    
    console.log('Clicking submit and waiting for navigation...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/invite/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.env?.supabaseKey || '',
          'Authorization': 'Bearer ' + (await window.supabase.auth.getSession()).data.session?.access_token
        },
        body: JSON.stringify({ gameId: 'g1' })
      });
      return { status: res.status, body: await res.text() };
    });

    console.log('Generate response:', result);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
