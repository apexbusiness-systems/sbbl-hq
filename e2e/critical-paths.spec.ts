import { expect, test } from '../playwright-fixture';

test.describe('critical path coverage', () => {
  test('home page renders header and content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header').getByRole('tab', { name: 'SBBL' })).toBeVisible();
  });

  test('league selector has three tabs with SBBL active by default', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'SBBL' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'WBL' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'TGIF' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'SBBL' })).toHaveAttribute('aria-selected', 'true');
  });

  test('league switch updates active tab state', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'WBL' }).click();
    await expect(page.getByRole('tab', { name: 'WBL' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'SBBL' })).toHaveAttribute('aria-selected', 'false');
  });

  test('login route renders sign in without leaking raw config names', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText(/VITE_SUPABASE|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL/);
  });

  test('login route renders trust bullets', async ({ page, isMobile }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    if (isMobile) {
      // Trust surface panel uses `hidden md:flex` — intentionally invisible on mobile.
      // Verify the text exists in the DOM but do not assert visibility.
      await expect(page.getByText('Three Leagues.')).toBeAttached();
      await expect(page.getByText('Live scoring and real-time game updates')).toBeAttached();
    } else {
      await expect(page.getByText('Three Leagues.')).toBeVisible();
      await expect(page.getByText('Live scoring and real-time game updates')).toBeVisible();
    }
  });

  test('release-cut navigation exposes only shipped primary routes', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    
    // For mobile, the nav is inside the drawer, for desktop it's in the header. We can search the whole page or just the header.
    // The drawer is within the header component.
    const nav = isMobile ? page.locator('header nav').last() : page.locator('header nav').first();
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Live', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Schedules', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Store', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Profiles', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Stats', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Leaderboards', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Media', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Teams', exact: true })).toBeVisible();
  });

  test('schedules and teams routes render headings', async ({ page }) => {
    await page.goto('/schedules', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
    await page.goto('/teams', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Teams & Standings' })).toBeVisible();
  });

  test('music player is present but does not autoplay before user gesture', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const audio = page.locator('audio').first();
    await expect(audio).toHaveCount(1);
    const state = await audio.evaluate((node: HTMLAudioElement) => ({ paused: node.paused, autoplay: node.autoplay }));
    expect(state.paused).toBeTruthy();
    expect(state.autoplay).toBeFalsy();
  });
});
