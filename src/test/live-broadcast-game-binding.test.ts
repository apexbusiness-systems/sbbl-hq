import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const livePageSrc = readFileSync(resolve(__dirname, '../pages/Live.tsx'), 'utf-8');
const streamApiSrc = readFileSync(resolve(__dirname, '../lib/api/stream.ts'), 'utf-8');
const viteConfigSrc = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf-8');

describe('live broadcast session binding', () => {
  it('persists gameId when toggling stream live status', () => {
    expect(streamApiSrc).toContain('gameId?: string | null;');
    expect(streamApiSrc).toContain('body: JSON.stringify({ isLive, gameId: gameId ?? null })');
  });

  it('hydrates and clears the backend-owned activeGameId from stream status/config', () => {
    expect(livePageSrc).toContain("setActiveGameId(typeof res.config.gameId === 'string' && res.config.gameId ? res.config.gameId : null);");
    expect(livePageSrc).toContain("setActiveGameId(typeof res.gameId === 'string' && res.gameId ? res.gameId : null);");
    expect(livePageSrc).not.toContain('setActiveGameId(mappedGame.id);');
  });

  it('never manufactures a fake broadcast session id for playback', () => {
    expect(livePageSrc).toContain('if (!activeGameId) return null;');
    expect(livePageSrc).toContain('return createSyntheticLiveGame(activeGameId);');
    expect(livePageSrc).not.toContain("activeGameId ?? 'broadcast'");
  });

  it('bypasses service worker caching for api routes', () => {
    expect(viteConfigSrc).toContain('/^\\/api\\//');
    expect(viteConfigSrc).toContain("url.pathname.startsWith('/api/')");
    expect(viteConfigSrc).toContain("handler: 'NetworkOnly'");
  });
});
