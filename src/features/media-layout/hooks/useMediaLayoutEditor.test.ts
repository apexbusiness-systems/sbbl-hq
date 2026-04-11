import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaLayoutEditor } from './useMediaLayoutEditor';
import type { MediaAsset } from '@/types';

const assets: MediaAsset[] = [
  { id: 'a', title: 'A', type: 'photo', thumbnail: '/a.jpg', leagueId: 'sbbl', status: 'published', date: '2026-01-01' },
  { id: 'b', title: 'B', type: 'photo', thumbnail: '/b.jpg', leagueId: 'sbbl', status: 'published', date: '2026-01-01' },
];

describe('useMediaLayoutEditor', () => {
  it('renders published order from layout', () => {
    const { result } = renderHook(() => useMediaLayoutEditor({
      section: { id: '1', slug: 'media-page-main', title: 'Main', capacity: 9, updatedAt: '2026-01-01' },
      items: [{ mediaAssetId: 'b', sortIndex: 0 }, { mediaAssetId: 'a', sortIndex: 1 }],
    }, assets));
    expect(result.current.orderedAssets.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('reorder changes local order and cancel restores baseline', () => {
    const { result } = renderHook(() => useMediaLayoutEditor(undefined, assets));
    act(() => result.current.setOrder(['b', 'a']));
    expect(result.current.orderedIds).toEqual(['b', 'a']);
    act(() => result.current.cancel());
    expect(result.current.orderedIds).toEqual(['a', 'b']);
  });
});
