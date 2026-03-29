import { test, expect } from '@playwright/test';

test.describe('critical path coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('home page renders header and content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('SBBL', { exact: false })).first().toBeVisible();
  });

  test('league selector has three tabs with ARIA roles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 15000 });
    await expect(tablist.locator('[role="tab"]')).toHaveCount(3);
  });

  test('clicking a league tab updates aria-selected', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 15000 });
    const secondTab = tablist.locator('[role="tab"]').nth(1);
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  });

  test('nav links to Teams and Schedules exist', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: 'Home' })).toBeVisible({ timeout: 15000 });
    await expect(nav.locator('a', { hasText: 'Teams' })).toBeVisible();
    await expect(nav.locator('a', { hasText: 'Schedules' })).toBeVisible();
  });

  test('deferred routes are not in nav', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    const nav = page.locator('nav');
    await expect(nav.locator('a', { hasText: 'Live' })).not.toBeVisible();
    await expect(nav.locator('a', { hasText: 'Store' })).not.toBeVisible();
    await expect(nav.locator('a', { hasText: 'Stats' })).not.toBeVisible();
  });

  test('no autoplay audio on page load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const audioPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? !audio.paused : false;
    });
    expect(audioPlaying).toBe(false);
  });

  test('sign in link is visible for unauthenticated users', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sign in')).toBeVisible();
  });
});
