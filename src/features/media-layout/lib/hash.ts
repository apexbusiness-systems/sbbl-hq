export function normalizeOrderedIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildLayoutPayloadHash(sectionSlug: string, orderedMediaAssetIds: string[]) {
  const normalized = normalizeOrderedIds(orderedMediaAssetIds);
  return sha256Hex(`${sectionSlug}:${JSON.stringify(normalized)}`);
}
