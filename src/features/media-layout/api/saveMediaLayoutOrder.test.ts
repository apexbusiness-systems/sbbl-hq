import { describe, expect, it, vi } from 'vitest';
import { saveMediaLayoutOrder } from './saveMediaLayoutOrder';

const fetchMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: { section: { id: '1', slug: 'media-page-main', title: 'Main', capacity: 9, updatedAt: '2026-01-01' }, items: [] } })));
vi.mock('@/lib/api/client', () => ({ apiFetch: fetchMock }));

describe('saveMediaLayoutOrder', () => {
  it('sends normalized ids in payload', async () => {
    await saveMediaLayoutOrder({
      sectionSlug: 'media-page-main',
      orderedMediaAssetIds: ['a', 'b', 'a'],
      idempotencyKey: 'idem',
      expectedSectionUpdatedAt: '2026-01-01',
    });
    const call = fetchMock.mock.calls[0] as unknown as [string, { body?: string }];
    expect(String(call[1]?.body)).toContain('"orderedMediaAssetIds":["a","b"]');
  });
});
