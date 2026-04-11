import { useMemo, useState } from 'react';
import type { MediaAsset } from '@/types';
import type { MediaLayoutResponse, MediaLayoutSaveState } from '../types/types';

export function useMediaLayoutEditor(layout: MediaLayoutResponse | undefined, assets: MediaAsset[]) {
  const orderedAssets = useMemo(() => {
    if (!layout) return assets;
    const orderMap = new Map(layout.items.map((item) => [item.mediaAssetId, item.sortIndex]));
    return [...assets].sort((a, b) => (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [layout, assets]);

  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [state, setState] = useState<MediaLayoutSaveState>('idle');

  const baseline = orderedAssets.map((asset) => asset.id);
  const current = localOrder.length ? localOrder : baseline;

  const setOrder = (next: string[]) => {
    setLocalOrder(next);
    setState('dirty');
  };

  const cancel = () => {
    setLocalOrder([]);
    setState('idle');
  };

  const resolveOrderedAssets = () => {
    const map = new Map(assets.map((asset) => [asset.id, asset]));
    return current.map((id) => map.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
  };

  return {
    state,
    setState,
    orderedAssets: resolveOrderedAssets(),
    orderedIds: current,
    isDirty: state === 'dirty' || state === 'failed',
    setOrder,
    cancel,
    baselineIds: baseline,
  };
}
