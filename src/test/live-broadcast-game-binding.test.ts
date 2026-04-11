import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const livePageSrc = readFileSync(resolve(__dirname, '../pages/Live.tsx'), 'utf-8');
const streamApiSrc = readFileSync(resolve(__dirname, '../lib/api/stream.ts'), 'utf-8');

describe('live broadcast session binding', () => {
  it('persists gameId when toggling stream live status', () => {
    expect(streamApiSrc).toContain('gameId?: string | null;');
    expect(streamApiSrc).toContain('body: JSON.stringify({ isLive, gameId: gameId ?? null })');
  });

  it('hydrates activeGameId from admin stream config before synthetic fallback is used', () => {
    expect(livePageSrc).toContain('if (typeof res.config.gameId === \'string\' && res.config.gameId) {');
    expect(livePageSrc).toContain('setActiveGameId(res.config.gameId);');
  });

  it('passes a real game binding into the admin go-live action', () => {
    expect(livePageSrc).toContain('await setStreamLive(nextLive, token, gameId);');
    expect(livePageSrc).toContain('gameId={liveGame?.id ?? activeGameId}');
  });
});
