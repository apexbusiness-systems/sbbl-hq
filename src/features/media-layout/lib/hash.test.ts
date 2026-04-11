import { describe, expect, it } from 'vitest';
import { buildLayoutPayloadHash, normalizeOrderedIds } from './hash';

describe('media layout hash helpers', () => {
  it('normalizes duplicate ids deterministically', () => {
    expect(normalizeOrderedIds(['a', 'b', 'a', '', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('builds stable payload hashes', async () => {
    const one = await buildLayoutPayloadHash('media-page-main', ['a', 'b', 'a']);
    const two = await buildLayoutPayloadHash('media-page-main', ['a', 'b']);
    expect(one).toEqual(two);
  });
});
