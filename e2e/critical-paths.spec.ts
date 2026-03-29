import { expect, test } from '../playwright-fixture';

test.describe('critical path coverage', () => {
  test('home page renders header and content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    // Apply .first() on the Locator before passing it to expect.
    await expect(page.getByText('SBBL', { exact: false }).first()).toBeVisible();
  });

  test('league selector has three controls', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'SBBL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WBL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TGIFBL' })).toBeVisible();
  });

  test('primary nav exposes Live route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Live' }).first()).toBeVisible();
  });

  test('home hero exposes call-to-actions', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Watch Live' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Full Schedule' })).toBeVisible();
  });

  test('schedules route renders heading', async ({ page }) => {
    await page.goto('/schedules', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  });

  test('teams route renders heading', async ({ page }) => {
    await page.goto('/teams', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  });

  test('store route renders heading', async ({ page }) => {
    await page.goto('/store', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Official Store' })).toBeVisible();
  });
});
