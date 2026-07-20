import { test, expect } from '@playwright/test';

test('check iframes', async ({ page }) => {
  console.log('Navigating to signup...');
  await page.goto('https://sbbl-hq.icu/login');
  
  const createOneLink = page.locator('text=Create one');
  if (await createOneLink.isVisible()) await createOneLink.click();
  const email = `throwaway-${Date.now()}@apexbusiness-systems.com`;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'TestPass123!');
  
  const signUpBtn = page.locator('button', { hasText: /SIGN UP/i }).first();
  if (await signUpBtn.isVisible()) await signUpBtn.click();
  else await page.locator('button', { hasText: /SIGN IN/i }).first().click();

  await page.waitForTimeout(4000);
  console.log('Navigating to /live...');
  await page.goto('https://sbbl-hq.icu/live', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(5000);
  
  const iframes = await page.locator('iframe').evaluateAll(iframes => iframes.map(i => i.src));
  console.log('IFRAMES FOUND:', iframes);
  
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT SNIPPET (first 200 chars):', pageText.substring(0, 200).replace(/\n/g, ' '));
  
  if (pageText.includes('offline') || pageText.includes('Offline')) {
    console.log('PAGE SAYS STREAM IS OFFLINE');
  }
});
