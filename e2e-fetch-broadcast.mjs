import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('get_active_broadcast') && response.request().method() === 'POST') {
      try {
        const body = await response.json();
        console.log('get_active_broadcast response:', body);
      } catch (e) {
        // ignore
      }
    }
  });

  try {
    await page.goto('https://sbbl-hq.icu/live', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for API calls
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
