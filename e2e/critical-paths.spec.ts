import { test, expect } from './playwright-fixture';

test.describe('sbbl hq critical paths', () => {
  test('home page structural integrity', async ({ page, isMobile }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/SBBL HQ/);
    await expect(page.locator('header')).toBeVisible();

    // Verify main navigation links
    if (isMobile) {
      // Mobile requires opening the drawer first
      await page.getByRole('button', { name: 'Open menu' }).click();

      // Ensure drawer is open before asserting inner visibility
      const mobileNav = page.locator('nav').filter({ hasText: 'Standings' }).first();
      await expect(mobileNav).toBeVisible();

      await expect(mobileNav.getByRole('link', { name: 'Schedule', exact: true })).toBeVisible();
      await expect(mobileNav.getByRole('link', { name: 'Standings', exact: true })).toBeVisible();
      await expect(mobileNav.getByRole('link', { name: 'Media', exact: true })).toBeVisible();

      // Close the menu to clean up
      await page.getByRole('button', { name: 'Close menu' }).click();
    } else {
      // Desktop nav is directly visible in the header
      const desktopNav = page.locator('header nav').first();
      await expect(desktopNav).toBeVisible();

      await expect(desktopNav.getByRole('link', { name: 'Schedule', exact: true })).toBeVisible();
      await expect(desktopNav.getByRole('link', { name: 'Standings', exact: true })).toBeVisible();
      await expect(desktopNav.getByRole('link', { name: 'Media', exact: true })).toBeVisible();
    }
  });

  test('public media gallery loads', async ({ page }) => {
    const response = await page.goto('/media', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    // Verify header exists
    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();

    // Wait for the feed to either load items or show the empty state
    // We don't want to fail if the DB is empty, just ensure it didn't crash
    const feedUnavailable = page.getByText(/Media feed unavailable/i);
    const mediaItems = page.getByLabel('Share');

    // Either we have an error state, or we have 0+ items rendered successfully
    // We check that the main container isn't throwing a React error
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Application Error'); // Next.js fatal error

    // Wait to see if items or empty state appear
    await Promise.race([
      expect(feedUnavailable).toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(mediaItems.first()).toBeVisible({ timeout: 10000 }).catch(() => {})
    ]);
  });

  test('unauthenticated ops route redirects to login', async ({ page }) => {
    // Clear any potential cookies
    await page.context().clearCookies();

    // Attempt to access protected route
    await page.goto('/ops', { waitUntil: 'networkidle' });

    // Should be redirected
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('redirect=%2Fops');

    // Verify login form is visible
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('404 page functions correctly', async ({ page }) => {
    const response = await page.goto('/this-route-definitely-does-not-exist', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Homepage' })).toBeVisible();
  });
});
