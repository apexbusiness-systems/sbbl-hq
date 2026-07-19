import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('redeem_ppv_invite') && response.request().method() === 'POST') {
      console.log('RPC STATUS:', response.status());
      try {
        const body = await response.text();
        console.log('RPC RESPONSE BODY:', body);
      } catch (e) {}
    }
  });

  try {
    // Intercept the RPC call that tells the UI the broadcast is free/accessible
    await page.route('**/rest/v1/rpc/get_active_broadcast*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_live: true,
          stream_url: null, 
          title: 'Testing Paywall',
          active_game_id: null,
          live_started_at: new Date().toISOString(),
          requires_payment: true, 
          is_subscribed: false,
          has_entitlement: false,
          user_registered: true
        })
      });
    });

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

    if (!page.url().includes('/live')) {
      await page.goto('https://sbbl-hq.icu/live', { waitUntil: 'networkidle' });
    }

    const inputLocator = page.locator('input[placeholder="SBBL-XXXX-XXXX"]');
    await inputLocator.waitFor({ state: 'visible', timeout: 10000 });
    await inputLocator.fill('ed918b02-42f4-4b7d-9a33-fc0611c53117');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Redeem Code")');

    await page.waitForTimeout(5000); // Wait to capture response
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
