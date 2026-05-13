import { expect, seedSuperAdminSession, test } from '../playwright-fixture';

// End-to-end verification of the Media Library admin tab added to /ops.
// Covers the real-world flows the feature was built for:
//   1. List rows (including drafts/archived that /media intentionally hides)
//   2. Filter by status — must re-fetch with a `status=` query string
//   3. Inline edit (title + status) — PATCH /ops/media/publications/:id
//   4. Archive — DELETE /ops/media/publications/:id with confirm()
//
// All backend calls are intercepted at the page.route level and the captured
// request payloads are asserted against the UI actions, so this covers the
// full client → network → UI feedback loop.

type MediaRow = {
  id: string;
  mediaAssetId: string;
  surface: string;
  title: string;
  subtitle: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishedAt: string | null;
  scheduledAt: string | null;
  sortAt: string;
  leagueId: string | null;
  leagueCode: string | null;
  leagueName: string | null;
  type: string;
  thumbnail: string;
  createdAt: string;
};

const SBBL_LEAGUE_UUID = '11111111-1111-1111-1111-111111111111';
const WBL_LEAGUE_UUID = '22222222-2222-2222-2222-222222222222';

const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fQAAAAASUVORK5CYII=';

function buildInitialRows(): MediaRow[] {
  return [
    {
      id: 'pub-potg-001',
      mediaAssetId: 'asset-potg-001',
      surface: 'potg',
      title: 'Michael Ramos POTG',
      subtitle: null,
      status: 'published',
      publishedAt: '2026-04-10T12:00:00Z',
      scheduledAt: null,
      sortAt: '2026-04-10T12:00:00Z',
      leagueId: SBBL_LEAGUE_UUID,
      leagueCode: 'sbbl',
      leagueName: 'SBBL',
      type: 'poster',
      thumbnail: TRANSPARENT_PIXEL,
      createdAt: '2026-04-10T12:00:00Z',
    },
    {
      id: 'pub-event-001',
      mediaAssetId: 'asset-event-001',
      surface: 'event',
      title: 'Friday Night Run Flyer',
      subtitle: null,
      status: 'draft',
      publishedAt: null,
      scheduledAt: null,
      sortAt: '2026-04-09T18:00:00Z',
      leagueId: null,
      leagueCode: null,
      leagueName: null,
      type: 'photo',
      thumbnail: TRANSPARENT_PIXEL,
      createdAt: '2026-04-09T18:00:00Z',
    },
    {
      id: 'pub-store-001',
      mediaAssetId: 'asset-store-001',
      surface: 'store',
      title: 'Hype Shirt Promo',
      subtitle: null,
      status: 'published',
      publishedAt: '2026-04-08T12:00:00Z',
      scheduledAt: null,
      sortAt: '2026-04-08T12:00:00Z',
      leagueId: WBL_LEAGUE_UUID,
      leagueCode: 'wbl',
      leagueName: 'WBL',
      type: 'poster',
      thumbnail: TRANSPARENT_PIXEL,
      createdAt: '2026-04-08T12:00:00Z',
    },
  ];
}

async function registerBaseOpsRoutes(page: import('@playwright/test').Page) {
  await page.route('**/ops/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        user: { userId: 'ops-user', email: 'ops@test.local' },
        roles: ['super_admin'],
        references: {},
        importHistory: [],
      }),
    }),
  );

  await page.route('**/ops/imports/history', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, jobs: [] }) }),
  );
}

test.describe('ops media editor admin', () => {
  test('lists publications, filters by status, edits, and archives', async ({ page }) => {
    await seedSuperAdminSession(page);
    await registerBaseOpsRoutes(page);

    // Mutable server-side state so sequential mutations are reflected in
    // subsequent list refetches — the admin flow relies on invalidation.
    const rows = buildInitialRows();

    const listCaptures: Array<{ query: string }> = [];
    const patchCaptures: Array<{ id: string; body: Record<string, unknown>; idempotency: string | null }> = [];
    const deleteCaptures: Array<{ id: string; idempotency: string | null }> = [];

    await page.route('**/ops/list/media*', async (route) => {
      const url = new URL(route.request().url());
      listCaptures.push({ query: url.searchParams.toString() });

      const statusParam = url.searchParams.get('status');
      const surfaceParam = url.searchParams.get('surface');
      const leagueParam = url.searchParams.get('leagueId');

      const filtered = rows.filter((row) => {
        if (statusParam && row.status !== statusParam) return false;
        if (surfaceParam && row.surface !== surfaceParam) return false;
        if (leagueParam && row.leagueId !== leagueParam) return false;
        return true;
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: filtered }),
      });
    });

    await page.route('**/ops/media/publications/*', async (route) => {
      const req = route.request();
      const match = req.url().match(/\/ops\/media\/publications\/([^/?]+)/);
      const id = match?.[1] ?? 'unknown';
      const idempotency = await req.headerValue('x-idempotency-key');

      if (req.method() === 'PATCH') {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        patchCaptures.push({ id, body, idempotency });

        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) {
          const current = rows[idx];
          const nextStatus = (body.status as MediaRow['status']) ?? current.status;
          rows[idx] = {
            ...current,
            title: typeof body.title === 'string' ? body.title : current.title,
            status: nextStatus,
            leagueId:
              body.leagueId === null
                ? null
                : typeof body.leagueId === 'string'
                  ? body.leagueId
                  : current.leagueId,
            publishedAt:
              nextStatus === 'published'
                ? new Date().toISOString()
                : nextStatus === 'draft' || nextStatus === 'archived'
                  ? null
                  : current.publishedAt,
          };
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { id } }),
        });
        return;
      }

      if (req.method() === 'DELETE') {
        deleteCaptures.push({ id, idempotency });
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], status: 'archived', publishedAt: null };
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { id, status: 'archived' } }),
        });
        return;
      }

      await route.fulfill({ status: 405, body: 'method_not_allowed' });
    });

    // ── Navigate to Ops console and open the Media Library tab ───────────
    await page.goto('/ops', { waitUntil: 'domcontentloaded' });
    const mediaTab = page.getByRole('tab', { name: 'Media Library' });
    await expect(mediaTab).toBeVisible();
    await mediaTab.click();

    await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible();

    // Scope: the Media Library tab panel (TabsContent for value="media").
    // Radix sets role="tabpanel" on the active tab content, so we scope all
    // further locators there to avoid clashing with other tabs' markup.
    const panel = page.locator('[role="tabpanel"]').filter({ hasText: 'Media Library' });
    await expect(panel).toBeVisible();

    // Filter bar holds the status/surface filter buttons. We click the chip
    // buttons instead of using selects (the new MediaFilterBar uses visual chips).
    const filterBar = panel.locator('div.flex.flex-wrap.gap-4.items-end');
    const statusAllButton = filterBar.getByRole('button', { name: 'All' }).first();
    await expect(statusAllButton).toBeVisible();

    // Initial load: all three rows render — POTG, Event, Store.
    // Row selectors key off the stable `id: <uuid>` text node so they keep
    // matching even after the edit UI replaces the title <p> with an <input>.
    const rowBase = panel.locator('div.border.border-border.rounded-sm.bg-card');
    const potgRow = rowBase.filter({ hasText: 'pub-potg-001' });
    const eventRow = rowBase.filter({ hasText: 'pub-event-001' });
    const storeRow = rowBase.filter({ hasText: 'pub-store-001' });
    await expect(potgRow).toBeVisible();
    await expect(eventRow).toBeVisible();
    await expect(storeRow).toBeVisible();

    // Row counter reflects unfiltered list size.
    await expect(panel.getByText(/3 rows/)).toBeVisible();

    // Draft badge is visible on the event row (proves we're showing
    // non-published rows that /media intentionally hides).
    await expect(eventRow.getByText('draft', { exact: true })).toBeVisible();

    // ── Filter by status=draft — a new list fetch fires with ?status=draft
    // Click the "Draft" chip button in the filter bar
    const draftButton = filterBar.getByRole('button', { name: 'Draft' });
    await draftButton.click();
    await expect(panel.getByText(/1 rows/)).toBeVisible();
    await expect(potgRow).toHaveCount(0);
    await expect(storeRow).toHaveCount(0);
    await expect(eventRow).toBeVisible();

    expect(listCaptures.some((c) => c.query.includes('status=draft'))).toBeTruthy();

    // Reset filter back to "all" so we can edit the POTG row.
    // Click the "All" button to clear the status filter
    const allStatusButton = filterBar.getByRole('button', { name: 'All' }).first();
    await allStatusButton.click();
    await expect(panel.getByText(/3 rows/)).toBeVisible();

    // ── Edit flow: rename POTG + force status back to draft ─────────────
    await potgRow.getByRole('button', { name: 'Edit' }).click();

    // The EditMetadataModal should appear with title input and status dropdown
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const titleInput = modal.locator('input[placeholder="Publication title"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Michael Ramos POTG (Updated)');

    // Change the status to draft using the status select in the modal
    const statusSelect = modal.locator('select');
    await statusSelect.selectOption('draft');

    // Click the Save Changes button in the modal
    await modal.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for PATCH to land + optimistic refetch to repaint the row.
    await expect(potgRow.getByText('draft', { exact: true })).toBeVisible();
    await expect(page.getByText('Michael Ramos POTG (Updated)')).toBeVisible();

    // Assert the PATCH request body matches what the UI was asked to do.
    expect(patchCaptures).toHaveLength(1);
    expect(patchCaptures[0].id).toBe('pub-potg-001');
    expect(patchCaptures[0].body).toMatchObject({
      title: 'Michael Ramos POTG (Updated)',
      status: 'draft',
    });
    expect(patchCaptures[0].idempotency).toBeTruthy();

    // ── Archive flow: store row → DELETE + status flips to archived ─────
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Hype Shirt Promo');
      void dialog.accept();
    });
    await storeRow.getByRole('button', { name: 'Archive' }).click();

    await expect(storeRow.getByText('archived', { exact: true })).toBeVisible();

    expect(deleteCaptures).toHaveLength(1);
    expect(deleteCaptures[0].id).toBe('pub-store-001');
    expect(deleteCaptures[0].idempotency).toBeTruthy();

    // Once archived, the Archive button must disable (operator can't double-archive).
    await expect(storeRow.getByRole('button', { name: 'Archive' })).toBeDisabled();

    // ── Dismissing the confirm dialog must NOT fire a DELETE ───────────
    page.once('dialog', (dialog) => {
      void dialog.dismiss();
    });
    await eventRow.getByRole('button', { name: 'Archive' }).click();
    expect(deleteCaptures).toHaveLength(1); // still just the one from earlier
  });
});
