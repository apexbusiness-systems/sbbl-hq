import { test, expect } from '@playwright/test';

test.describe('critical path coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('home page renders without crashing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('SBBL', { exact: false })).first().toBeVisible();
  });

  test('home page shows league selector tabs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 10000 });
    const tabs = tablist.locator('[role="tab"]');
    await expect(tabs).toHaveCount(3);
  });

  test('league switch updates active tab', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 10000 });
    const wblTab = tablist.locator('[role="tab"]').nth(0); // WBL is order 1
    await wblTab.click();
    await expect(wblTab).toHaveAttribute('aria-selected', 'true');
  });

  test('login page renders without raw config errors', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Secure Sign In')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('VITE_SUPABASE')).not.toBeVisible();
  });

  test('login page shows trust surface on desktop', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Three Leagues.')).toBeVisible({ timeout: 10000 });
  });

  test('teams page is accessible from nav', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('nav a', { hasText: 'Teams' }).first().click();
    await expect(page).toHaveURL(/\/teams/);
  });

  test('nav only contains release-cut routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: 'Home' })).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Teams' })).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Schedules' })).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Live' })).not.toBeVisible();
    await expect(nav.locator('a', { hasText: 'Store' })).not.toBeVisible();
    await expect(nav.locator('a', { hasText: 'Stats' })).not.toBeVisible();
  });

  test('no autoplay audio on page load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for any async rendering
    await page.waitForTimeout(1000);
    const audioPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? !audio.paused : false;
    });
    expect(audioPlaying).toBe(false);
  });

  test('mobile login layout is complete', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Secure Sign In')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });
});
