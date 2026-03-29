import { expect, test } from '../playwright-fixture';
import type { Locator, Page } from '@playwright/test';

const expectAnyVisible = async (locators: Locator[]) => {
  await expect
    .poll(async () => {
      for (const locator of locators) {
        if (await locator.first().isVisible()) return true;
      }
      return false;
    }, { timeout: 10_000 })
    .toBe(true);
};

const leagueControl = (page: Page, name: string) => [
  page.getByRole('tab', { name }),
  page.getByRole('button', { name }),
];

test.describe('critical path coverage', () => {
  test('home page renders header and league switcher', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await expectAnyVisible(leagueControl(page, 'SBBL'));
  });

  test('league selector has SBBL, WBL, and TGIFBL controls', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectAnyVisible(leagueControl(page, 'SBBL'));
    await expectAnyVisible(leagueControl(page, 'WBL'));
    await expectAnyVisible(leagueControl(page, 'TGIFBL'));
  });

  test('primary nav exposes Home, Teams, and Schedules', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Teams' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Schedules' }).first()).toBeVisible();
  });

  test('home hero exposes release CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectAnyVisible([
      page.getByRole('link', { name: /Live Now|View Teams/i }),
      page.getByRole('link', { name: /Watch Live|Full Schedule/i }),
    ]);
  });

  test('schedules route renders heading', async ({ page }) => {
    await page.goto('/schedules', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  });

  test('teams route renders heading', async ({ page }) => {
    await page.goto('/teams', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  });
});
