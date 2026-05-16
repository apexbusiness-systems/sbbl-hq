import { test, expect, type Page } from '@playwright/test';

const STORE_SUPABASE_URL = 'https://playwright-store.supabase.co';
const STORE_SUPABASE_KEY = 'playwright-publishable-key';
const STORE_ACCESS_TOKEN = 'test-authcontext-jwt';
const STORE_USER_ID = '00000000-0000-4000-8000-000000000001';

async function mockStoreNoAuth(page: Page) {
  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
        supabaseUrl: null,
        supabasePublishableKey: null,
        googleOAuthEnabled: false,
      }),
    });
  });
}

async function mockStoreAuth(page: Page) {
  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        appName: 'SBBL HQ',
        defaultLeague: 'SBBL',
        supabaseUrl: STORE_SUPABASE_URL,
        supabasePublishableKey: STORE_SUPABASE_KEY,
        googleOAuthEnabled: false,
      }),
    });
  });

  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem('sb-playwright-store-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'store-e2e@example.test',
        app_metadata: {},
        user_metadata: {},
      },
    }));
  }, { token: STORE_ACCESS_TOKEN, userId: STORE_USER_ID });

  await page.route('**/auth/v1/user', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${STORE_ACCESS_TOKEN}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: STORE_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'store-e2e@example.test',
        app_metadata: {},
        user_metadata: {},
      }),
    });
  });

  await page.route('**/rest/v1/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'profile-store-e2e',
        user_id: STORE_USER_ID,
        display_name: 'Store E2E',
        full_name: 'Store E2E',
        bio: null,
        avatar_url: null,
        preferred_league: null,
        primary_role_intent: null,
        onboarding_completed_at: new Date().toISOString(),
        stripe_customer_id: null,
      }),
    });
  });

  await page.route('**/rest/v1/user_role_assignments**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

test.describe('store canonicalization', () => {
  test('store browse and add to bag works', async ({ page }) => {
    await mockStoreNoAuth(page);

    // Override the public products API to simulate a fast DB response
    await page.route('/api/public/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          data: [
            {
              id: 'prod_1',
              name: 'Test Jersey',
              category: 'jerseys',
              price: 50.00,
              image: '/images/store/mock.jpg',
              sizes: ['M', 'L'],
              colors: ['Black'],
              is_custom: false
            },
            {
              id: 'prod_2',
              name: 'Custom Team Kit',
              category: 'custom',
              price: 0,
              image: '/images/store/mock_custom.jpg',
              sizes: ['M'],
              colors: [],
              is_custom: true
            }
          ]
        }
      });
    });

    await page.goto('/store');

    // Check if products loaded
    await expect(page.locator('text=Test Jersey')).toBeVisible();
    await expect(page.locator('.truncate:has-text("Custom Team Kit")')).toBeVisible();

    // Click on product to see detail
    await page.locator('.truncate:has-text("Test Jersey")').click();
    await expect(page.locator('button:has-text("Add to Bag")')).toBeVisible();

    // Add to bag
    await page.locator('button:has-text("Add to Bag")').click();

    // The drawer should open, and "Your Bag" should be visible
    await expect(page.locator('h3:has-text("Your Bag")')).toBeVisible();
    await expect(page.locator('button:has-text("Proceed to Checkout")')).toBeVisible();

    // Check if item is in the bag
    await expect(page.locator('.animate-slide-in >> text=Test Jersey')).toBeVisible();
  });

  test('custom quote request submits idempotently', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    await page.route('/api/public/products', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          data: [
            {
              id: 'prod_2',
              name: 'Custom Team Kit',
              category: 'custom',
              price: 0,
              image: '/images/store/mock_custom.jpg',
              sizes: ['M'],
              colors: [],
              is_custom: true
            }
          ]
        }
      });
    });

    let quoteCallCount = 0;
    await page.route('/api/store/quote', async (route) => {
      quoteCallCount++;
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      expect(route.request().headers().authorization).toBe(`Bearer ${STORE_ACCESS_TOKEN}`);
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    // Seed a real AuthContext session through Supabase's storage contract.
    // Store.tsx must read this only via useAuth().session, never direct localStorage.
    await mockStoreAuth(page);

    await page.goto('/store');

    // Select custom kit
    await page.locator('.truncate:has-text("Custom Team Kit")').click();

    // Open quote dialog
    await page.locator('button:has-text("Request Custom Quote")').click();
    await expect(page.locator('text=Your Name')).toBeVisible();

    // Fill form
    await page.fill('input:below(:text("Your Name"))', 'Jane Doe');
    await page.fill('input:below(:text("Team / Organization"))', 'Apex Predators');
    await page.fill('input:below(:text("Estimated Quantity"))', '15');

    // Submit form
    await page.locator('button:has-text("Submit Request")').click();

    // Wait a bit to let logs flush
    await page.waitForTimeout(2000);

    // Endpoint should have been hit exactly once
    expect(quoteCallCount).toBe(1);
  });
});
