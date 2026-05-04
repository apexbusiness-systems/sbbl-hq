import { describe, expect, it } from 'vitest';
import { assessFacebookUniversalIngest } from '@/lib/stream/facebook-universal-ingest';

describe('assessFacebookUniversalIngest', () => {
  it('marks non-facebook URL unsupported', () => {
    expect(assessFacebookUniversalIngest('https://youtube.com/watch?v=abc')).toMatchObject({
      mode: 'unsupported',
      reason: 'non-facebook-url',
    });
  });

  it('accepts resolved HLS as direct-hls', () => {
    expect(assessFacebookUniversalIngest('https://video-edge.example/live.m3u8?sig=1')).toMatchObject({
      mode: 'direct-hls',
      playableInBrowser: true,
    });
  });

  it('classifies facebook URLs as server-relay candidates', () => {
    expect(assessFacebookUniversalIngest('https://www.facebook.com/acme/videos/123')).toMatchObject({
      mode: 'server-relay',
      requiresServerCredentials: true,
    });
  });
});
