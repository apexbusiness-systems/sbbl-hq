import { test, expect } from '@playwright/test';

test('viewer preflight renders when enabled', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sbbl_test_flags', JSON.stringify({ VITE_FEATURE_SHOW_VIEWER_PREFLIGHT: 'true' }));
  });
  await page.goto('/live');
  await expect(page.getByTestId('viewer-preflight')).toBeVisible({ timeout: 10_000 });
});

test('preflight loading and error states are non-crashing', async ({ page }) => {
  await page.route('**/api/streams/**/preflight', async (route) => {
    await route.fulfill({ status: 500, body: JSON.stringify({ ok: false, error: 'boom' }) });
  });
  await page.goto('/live');
  await expect(page.getByTestId('preflight-error')).toBeVisible({ timeout: 10_000 });
});
