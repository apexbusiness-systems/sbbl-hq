import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOpsMediaLibrary } from '../useOpsMediaLibrary';

// Mock the API module — must include all exports used by the hook
vi.mock('@/lib/api/ops', () => ({
  fetchOpsMediaList: vi.fn(() =>
    Promise.resolve({
      ok: true,
      data: [
        {
          id: 'pub1',
          title: 'Test Publication 1',
          status: 'published',
          surface: 'store',
          leagueId: 'wbl',
          leagueCode: 'WBL',
          leagueName: 'Weekend Basketball League',
          createdAt: '2024-05-01T00:00:00Z',
          pinnedAt: null,
          needsReview: false,
          parserConfidence: null,
        },
        {
          id: 'pub2',
          title: 'Test Publication 2',
          status: 'draft',
          surface: 'potg',
          leagueId: null,
          leagueCode: null,
          leagueName: null,
          createdAt: '2024-05-02T00:00:00Z',
          pinnedAt: null,
          needsReview: false,
          parserConfidence: null,
        },
      ],
    })
  ),
  patchOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  deleteOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  updateOpsMediaPublicationOrder: vi.fn(() => Promise.resolve({ ok: true, updated: 2 })),
  bulkArchiveOpsMedia: vi.fn(() => Promise.resolve({ ok: true, archived: 1, ids: ['pub1'] })),
  pinOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  unpinOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  restoreOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  fetchOpsStaleMedia: vi.fn(() => Promise.resolve({ ok: true, data: [], days: 30 })),
  archiveOpsStaleMedia: vi.fn(() => Promise.resolve({ ok: true, archived: 0 })),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn((options) => ({
      data: options.queryFn?.(),
      isLoading: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      error: null,
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      variables: null,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
      cancelQueries: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
    })),
  };
});

describe('useOpsMediaLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(false));

    expect(result.current.statusFilter).toBe('all');
    expect(result.current.surfaceFilter).toBe('all');
    expect(result.current.leagueFilter).toBe('all');
    expect(result.current.sortBy).toBe('newest');
    expect(result.current.search).toBe('');
    expect(result.current.previewId).toBe(null);
    expect(result.current.editId).toBe(null);
    expect(result.current.archiveId).toBe(null);
    expect(result.current.restoreId).toBe(null);
    expect(result.current.isBulkMode).toBe(false);
    expect(result.current.bulkSelectedIds.size).toBe(0);
  });

  it('allows setting status filter', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setStatusFilter('published');
    });

    expect(result.current.statusFilter).toBe('published');
  });

  it('allows setting surface filter', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setSurfaceFilter('store');
    });

    expect(result.current.surfaceFilter).toBe('store');
  });

  it('allows setting league filter', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setLeagueFilter('wbl');
    });

    expect(result.current.leagueFilter).toBe('wbl');
  });

  it('allows setting sort order', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setSortBy('oldest');
    });

    expect(result.current.sortBy).toBe('oldest');
  });

  it('allows setting search term', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setSearch('test query');
    });

    expect(result.current.search).toBe('test query');
  });

  it('resets all filters including search', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setStatusFilter('published');
      result.current.setSurfaceFilter('store');
      result.current.setLeagueFilter('wbl');
      result.current.setSearch('hello');
      result.current.resetFilters();
    });

    expect(result.current.statusFilter).toBe('all');
    expect(result.current.surfaceFilter).toBe('all');
    expect(result.current.leagueFilter).toBe('all');
    expect(result.current.search).toBe('');
  });

  it('allows moving media items in order', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setMediaOrderIds(['id1', 'id2', 'id3']);
    });

    act(() => {
      result.current.moveMedia('id2', 'down');
    });

    expect(result.current.mediaOrderIds).toEqual(['id1', 'id3', 'id2']);
  });

  it('prevents moving up when at top', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setMediaOrderIds(['id1', 'id2', 'id3']);
    });

    act(() => {
      result.current.moveMedia('id1', 'up');
    });

    expect(result.current.mediaOrderIds).toEqual(['id1', 'id2', 'id3']);
  });

  it('prevents moving down when at bottom', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setMediaOrderIds(['id1', 'id2', 'id3']);
    });

    act(() => {
      result.current.moveMedia('id3', 'down');
    });

    expect(result.current.mediaOrderIds).toEqual(['id1', 'id2', 'id3']);
  });

  it('allows setting preview ID', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setPreviewId('pub1');
    });

    expect(result.current.previewId).toBe('pub1');
  });

  it('allows setting edit ID', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setEditId('pub1');
    });

    expect(result.current.editId).toBe('pub1');
  });

  it('allows setting archive ID', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setArchiveId('pub1');
    });

    expect(result.current.archiveId).toBe('pub1');
  });

  it('allows setting restore ID', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setRestoreId('pub1');
    });

    expect(result.current.restoreId).toBe('pub1');
  });

  it('toggles bulk mode on and off', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setIsBulkMode(true);
    });

    expect(result.current.isBulkMode).toBe(true);

    act(() => {
      result.current.exitBulkMode();
    });

    expect(result.current.isBulkMode).toBe(false);
    expect(result.current.bulkSelectedIds.size).toBe(0);
  });

  it('toggles bulk item selection', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.toggleBulkSelect('id1');
    });

    expect(result.current.bulkSelectedIds.has('id1')).toBe(true);

    act(() => {
      result.current.toggleBulkSelect('id1');
    });

    expect(result.current.bulkSelectedIds.has('id1')).toBe(false);
  });

  it('clears bulk selection', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.toggleBulkSelect('id1');
      result.current.toggleBulkSelect('id2');
      result.current.clearBulkSelection();
    });

    expect(result.current.bulkSelectedIds.size).toBe(0);
  });

  it('opens and closes stale cleanup', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.openStaleCleanup();
    });

    expect(result.current.staleCleanupOpen).toBe(true);

    act(() => {
      result.current.closeStaleCleanup();
    });

    expect(result.current.staleCleanupOpen).toBe(false);
  });

  it('provides is loading state', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('provides is error state', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));
    expect(typeof result.current.isError).toBe('boolean');
  });
});
