import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOpsMediaLibrary } from '../useOpsMediaLibrary';

// Mock the API module
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
        },
      ],
    })
  ),
  patchOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  deleteOpsMediaPublication: vi.fn(() => Promise.resolve({ ok: true })),
  updateOpsMediaPublicationOrder: vi.fn(() => Promise.resolve({ ok: true, updated: 2 })),
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
    useMutation: vi.fn((options) => ({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      variables: null,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
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
    expect(result.current.previewId).toBe(null);
    expect(result.current.editId).toBe(null);
    expect(result.current.archiveId).toBe(null);
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

  it('resets all filters', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    act(() => {
      result.current.setStatusFilter('published');
      result.current.setSurfaceFilter('store');
      result.current.setLeagueFilter('wbl');
      result.current.resetFilters();
    });

    expect(result.current.statusFilter).toBe('all');
    expect(result.current.surfaceFilter).toBe('all');
    expect(result.current.leagueFilter).toBe('all');
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

  it('provides is loading state', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('provides is error state', () => {
    const { result } = renderHook(() => useOpsMediaLibrary(true));

    expect(typeof result.current.isError).toBe('boolean');
  });
});
