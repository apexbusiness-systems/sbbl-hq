import { test, expect } from '@playwright/test';

test.describe('critical path coverage', () => {
  test('home page renders without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=SBBL')).toBeVisible();
  });

  test('home page shows league selector', async ({ page }) => {
    await page.goto('/');
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    await expect(tabs.locator('[role="tab"]')).toHaveCount(3);
  });

  test('league switch updates active tab', async ({ page }) => {
    await page.goto('/');
    const wblTab = page.locator('[role="tab"]:has-text("WBL")');
    await wblTab.click();
    await expect(wblTab).toHaveAttribute('aria-selected', 'true');
  });

  test('login page renders without raw config errors', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Secure Sign In')).toBeVisible();
    await expect(page.locator('text=VITE_SUPABASE')).not.toBeVisible();
  });

  test('login page shows trust bullets on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await expect(page.locator('text=Three Leagues.')).toBeVisible();
  });

  test('teams page is accessible from nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.locator('nav a:has-text("Teams")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/teams');
  });

  test('primary nav only contains release-cut routes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('nav a:has-text("Home")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Teams")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Live")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Store")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Stats")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Media")')).not.toBeVisible();
  });

  test('no autoplay audio on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const audioPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? !audio.paused : false;
    });
    expect(audioPlaying).toBe(false);
  });

  test('mobile login layout is complete', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Secure Sign In')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Send Magic Link")')).toBeVisible();
  });
});
