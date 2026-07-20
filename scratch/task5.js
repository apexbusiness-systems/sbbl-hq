const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ 
    headless: true, 
    channel: 'chrome' // or use default if 'chrome' is not installed
  }).catch(async () => {
    // fallback if chrome channel fails
    return await chromium.launch({ headless: true });
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  
  const requests = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('.m3u8') || url.includes('.ts') || url.includes('whep') || url.includes('facebook.com')) {
      requests.push(`[${new Date().toISOString()}] ${response.status()} ${url.substring(0, 100)}...`);
    }
  });

  console.log('Navigating to signup...');
  await page.goto('https://sbbl-hq.icu/login');
  
  // Click "Create one" or switch to signup
  const createOneLink = page.locator('text=Create one');
  if (await createOneLink.isVisible()) {
    await createOneLink.click();
  }

  const email = `throwaway-${Date.now()}@apexbusiness-systems.com`;
  console.log(`Signing up with ${email}...`);
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'TestPass123!');
  
  // Find the sign up button
  const signUpBtn = page.locator('button', { hasText: /SIGN UP/i }).first();
  if (await signUpBtn.isVisible()) {
    await signUpBtn.click();
  } else {
    // Maybe it's just one form
    const signInBtn = page.locator('button', { hasText: /SIGN IN/i }).first();
    await signInBtn.click();
  }

  await page.waitForTimeout(3000);
  
  console.log('Navigating to /live...');
  await page.goto('https://sbbl-hq.icu/live', { waitUntil: 'networkidle' });
  
  // If there's a "Start Stream" or "Watch Live on Facebook" CTA, click it?
  // Facebook CTA is a link, it might open a new tab. We just need to verify the player region.
  
  console.log('Taking screenshot 1...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_1.png' });
  
  console.log('Waiting 20s...');
  await page.waitForTimeout(20000);
  console.log('Taking screenshot 2...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_2.png' });
  
  console.log('Waiting 20s...');
  await page.waitForTimeout(20000);
  console.log('Taking screenshot 3...');
  await page.screenshot({ path: 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da\\live_3.png' });

  console.log('--- NETWORK LOG (Media/Streaming) ---');
  requests.forEach(r => console.log(r));
  
  await browser.close();
  console.log('Done.');
})();
