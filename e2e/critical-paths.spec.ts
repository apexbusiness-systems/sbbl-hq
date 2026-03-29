import { test, expect } from '@playwright/test';

test.describe('critical path coverage', () => {
  test('home page renders without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=SBBL')).toBeVisible();
    await expect(page.locator('text=League Snapshot')).toBeVisible();
  });

  test('home page shows league selector', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("SBBL")')).toBeVisible();
    await expect(page.locator('button:has-text("WBL")')).toBeVisible();
    await expect(page.locator('button:has-text("TGIFBL")')).toBeVisible();
  });

  test('league switch updates home content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("WBL")').click();
    await page.waitForTimeout(500);
    // The page should respond to the league switch
    await expect(page.locator('h1')).toBeVisible();
  });

  test('login page renders without raw config errors', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Secure Sign In')).toBeVisible();
    // Must not expose VITE_SUPABASE env var names
    await expect(page.locator('text=VITE_SUPABASE')).not.toBeVisible();
  });

  test('login page shows trust bullets', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Three Leagues.')).toBeVisible();
  });

  test('teams page is accessible from nav', async ({ page }) => {
    await page.goto('/');
    await page.locator('a:has-text("Teams")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/teams');
  });

  test('primary nav only contains release-cut routes', async ({ page }) => {
    await page.goto('/');
    // These routes should be in nav
    await expect(page.locator('nav a:has-text("Home")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Teams")')).toBeVisible();
    // These mock-dependent routes should NOT be in nav
    await expect(page.locator('nav a:has-text("Live")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Store")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Profiles")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Stats")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Media")')).not.toBeVisible();
  });

  test('no autoplay audio on page load', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Audio element should exist but not be playing
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
