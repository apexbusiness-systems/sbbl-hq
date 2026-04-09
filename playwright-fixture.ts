import { expect, test, type Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://ezanilxygnpucwkwpsoc.supabase.co';
const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_EMAIL = 'ops-super-admin@test.local';

const buildSessionStorageKey = () => {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0] ?? 'local';
  return `sb-${ref}-auth-token`;
};

export async function seedSuperAdminSession(page: Page) {
  const user = {
    id: DEFAULT_USER_ID,
    email: DEFAULT_EMAIL,
    role: 'authenticated',
    aud: 'authenticated',
  };

  const session = {
    access_token: 'playwright-access-token',
    refresh_token: 'playwright-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };

  await page.route(`${SUPABASE_URL}/auth/v1/user**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/token**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, async (route) => {
    const accept = route.request().headerValue('accept') ?? '';
    const profile = {
      id: 'profile-1',
      user_id: DEFAULT_USER_ID,
      display_name: 'Ops Super Admin',
      full_name: 'Ops Super Admin',
      bio: null,
      avatar_url: null,
      preferred_league: 'sbbl',
      primary_role_intent: 'admin',
      onboarding_completed_at: '2026-04-09T00:00:00Z',
      stripe_customer_id: null,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accept.includes('application/vnd.pgrst.object+json') ? profile : [profile]),
    });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/user_role_assignments**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ role: 'super_admin' }]),
    });
  });

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: buildSessionStorageKey(), value: JSON.stringify(session) },
  );
}

export { expect, test };
