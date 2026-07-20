import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://sbbl-hq.icu/login');
    await page.fill('input[type="email"]', 'gamepointagent@gmail.com');
    await page.fill('input[type="password"]', 'Apex143!');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);

    const result = await page.evaluate(async () => {
      const res = await fetch('/rest/v1/rpc/redeem_ppv_invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.env?.supabaseKey || '',
          'Authorization': 'Bearer ' + (await window.supabase.auth.getSession()).data.session?.access_token
        },
        body: JSON.stringify({ p_code: 'ed918b02-42f4-4b7d-9a33-fc0611c53117' })
      });
      return await res.text();
    });

    console.log('RPC response:', result);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
