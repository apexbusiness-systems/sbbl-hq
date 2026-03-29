import { expect, test } from '../playwright-fixture';

test.describe('critical path coverage', () => {
  test('home page and header render', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
  });

  test('league selector exposes all three canonical tabs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tablist', { name: 'League selector' })).toBeVisible();
    await expect(page.getByTestId('league-tab-sbbl')).toBeVisible();
    await expect(page.getByTestId('league-tab-wbl')).toBeVisible();
    await expect(page.getByTestId('league-tab-tgifbl')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'SBBL' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'WBL' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'TGIFBL' })).toBeVisible();
  });

  test('primary nav only exposes release routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const primaryNav = page.locator('header nav').first();
    await expect(primaryNav).toBeVisible();
    await expect(primaryNav.getByRole('link')).toHaveCount(3);
    await expect(primaryNav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(primaryNav.getByRole('link', { name: 'Teams' })).toBeVisible();
    await expect(primaryNav.getByRole('link', { name: 'Schedules' })).toBeVisible();
  });

  test('home hero exposes release CTA labels', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Live Now' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Teams' })).toBeVisible();
  });

  test('teams route renders heading', async ({ page }) => {
    await page.goto('/teams', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  });

  test('schedules route renders heading', async ({ page }) => {
    await page.goto('/schedules', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  });

  test('login route renders heading', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});
