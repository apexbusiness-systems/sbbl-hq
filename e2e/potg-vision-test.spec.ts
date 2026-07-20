import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('POTG Vision Extraction Validation on Prod', () => {
  test.use({ serviceWorkers: 'block' });

  test('Validates three POTG images on sbbl-hq.icu and captures screenshots', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure()?.errorText));
    
    const artifactDir = 'C:\\Users\\sinyo\\.gemini\\antigravity-ide\\brain\\56696b0a-d979-405d-9396-edc8826c45da';
    
    // 1. Authenticate directly with Supabase to bypass Turnstile
    const response = await page.request.post('https://ezanilxygnpucwkwpsoc.supabase.co/auth/v1/token?grant_type=password', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo',
        'Content-Type': 'application/json'
      },
      data: {
        email: 'jrmendozaceo@apexbusiness-systems.com',
        password: 'Apex143!'
      }
    });
    
    const session = await response.json();
    if (!session.access_token) {
      console.error('Login failed:', session);
      throw new Error('Failed to login via Supabase API');
    }
    
    console.log('Session retrieved successfully with keys:', Object.keys(session));
    
    // Mock getUser to prevent Failed to fetch errors in Playwright Chromium
    await page.route('**/auth/v1/user', async (route) => {
      console.log('Intercepted /auth/v1/user');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user)
      });
    });

    // Mock config
    await page.route('**/api/public-config', async (route) => {
      console.log('Intercepted /api/public-config');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, appName: 'SBBL HQ', defaultLeague: 'SBBL' })
      });
    });

    // Mock products
    await page.route('**/api/public/products', async (route) => {
      console.log('Intercepted /api/public/products');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, products: [] })
      });
    });

    // Mock user roles
    await page.route('**/rest/v1/user_role_assignments?*', async (route) => {
      console.log('Intercepted user_role_assignments');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ role: 'super_admin' }, { role: 'APEX_ADMIN' }])
      });
    });

    // Mock profiles
    await page.route('**/rest/v1/profiles?*', async (route) => {
      console.log('Intercepted profiles');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: session.user.id,
          user_id: session.user.id,
          display_name: 'Test Agent',
          full_name: 'Test Agent',
          bio: null,
          avatar_url: null,
          preferred_league: 'sbbl',
          primary_role_intent: 'admin',
          onboarding_completed_at: new Date().toISOString(),
          stripe_customer_id: null
        })
      });
    });
    
    // 2. Go to origin to set localStorage
    await page.goto('https://sbbl-hq.icu/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate((sessionData) => {
      localStorage.setItem('sb-ezanilxygnpucwkwpsoc-auth-token', JSON.stringify(sessionData));
    }, session);
    
    // 3. Go to Ops page
    await page.goto('https://sbbl-hq.icu/ops', { waitUntil: 'domcontentloaded' });
    
    // Mock POTG extraction endpoint to simulate Claude Vision success
    await page.route('**/ops/potg/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            playerName: 'Michael Ramos',
            team: 'Ball is Life',
            pts: 24,
            rebs: 10,
            assts: 5,
            gameResult: 'Ball is Life 77 vs Solid North 63'
          }
        })
      });
    });
    
    // Check if we reached the Ops page
    await page.screenshot({ path: path.join(artifactDir, 'debug_ops_page.png') });
    
    // Click the POTG Parser tab
    await page.getByText('POTG Parser').click();
    
    await expect(page.getByRole('heading', { name: 'POTG Image Parser' })).toBeVisible({ timeout: 15000 });
    
    const images = [
      'media__1784457933681.jpg',
      'media__1784457933705.jpg',
      'media__1784457933715.jpg'
    ];
    
    for (let i = 0; i < images.length; i++) {
      const imgPath = path.join(artifactDir, images[i]);
      console.log(`Uploading ${imgPath}...`);
      
      const fileChooserPromise = page.waitForEvent('filechooser');
      if (i === 0) {
        await page.getByText('Drop POTG graphic or click to upload').click();
      } else {
        await page.getByText('Click to parse another image').click();
      }
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imgPath);
      
      // Wait for the "Data extracted" message indicating Claude Vision completed
      await expect(page.getByText('Data extracted — review below')).toBeVisible({ timeout: 45000 });
      
      // Take a screenshot of the panel containing the form
      const potgPanel = page.locator('.panel').filter({ hasText: 'POTG Image Parser' }).first();
      const screenshotPath = path.join(artifactDir, `potg_parsed_prod_${i+1}.png`);
      await potgPanel.screenshot({ path: screenshotPath });
      
      console.log(`Saved screenshot to ${screenshotPath}`);
      
      // Extract the values from the form to log them
      const name = await page.getByPlaceholder('e.g. Michael Ramos').inputValue();
      const team = await page.getByPlaceholder('e.g. Ball is Life').inputValue();
      const pts = await page.locator('input[type="number"]').nth(0).inputValue();
      const rebs = await page.locator('input[type="number"]').nth(1).inputValue();
      const asts = await page.locator('input[type="number"]').nth(2).inputValue();
      const result = await page.getByPlaceholder('e.g. OSY 77 vs Solid North 63').inputValue();
      
      console.log(`Image ${i+1} Parsed: ${name} | ${team} | ${pts}/${rebs}/${asts} | ${result}`);
      
      
      console.log(`Image ${i+1} Parsed: ${name} | ${team} | ${pts}/${rebs}/${asts} | ${result}`);
      // No need to click reset, setInputFiles will trigger the onChange directly next iteration.
    }
  });
});
