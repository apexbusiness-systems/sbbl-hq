import { test, expect } from '@playwright/test';

test('login network check', async ({ page }) => {
  const requests: string[] = [];
  let tokenErrorFound = false;

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    requests.push(`${status} ${url}`);
    
    if (url.includes('/auth/v1/token') && status >= 400) {
      console.error(`ERROR: Found 4xx on token endpoint: ${status} ${url}`);
      tokenErrorFound = true;
    }
  });

  console.log("Navigating to https://sbbl-hq.icu/login...");
  await page.goto('https://sbbl-hq.icu/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\login_render.png' });
  
  console.log("NETWORK LOG:");
  requests.forEach(r => console.log(r));
  
  expect(tokenErrorFound).toBe(false);
});
