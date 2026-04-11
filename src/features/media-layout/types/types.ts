export type MediaLayoutSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';

export type MediaLayoutSection = {
  id: string;
  slug: string;
  title: string;
  capacity: number;
  updatedAt: string;
};

export type MediaLayoutItem = {
  mediaAssetId: string;
  sortIndex: number;
};

export type MediaLayoutResponse = {
  section: MediaLayoutSection;
  items: MediaLayoutItem[];
};
