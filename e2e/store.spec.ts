import { test, expect } from '@playwright/test';

test.describe('store canonicalization', () => {
  test('store browse and add to bag works', async ({ page }) => {
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
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    // Make UI think it has token
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-zofpeqwrmxemymvtdwct-auth-token', JSON.stringify({
        access_token: 'eyMock',
        refresh_token: 'eyMock',
        user: { id: 'user_1', role: 'authenticated' },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600
      }));
    });

    // Mock session API to let useAuth pass
    await page.route('/api/auth/session', async (route) => {
        await route.fulfill({
            status: 200,
            json: {
                ok: true,
                session: {
                    user: { id: "user_1", role: "authenticated" },
                    access_token: "eyMock"
                }
            }
        });
    });

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
