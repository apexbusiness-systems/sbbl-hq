/**
 * csp-livestream.unit.test.ts
 * Verifies that the Content-Security-Policy emitted by addSecurityHeaders()
 * contains every domain required for YouTube Live + Twitch stream playback.
 * This test is the regression guard for the April 2026 livestream outage.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Extract the CSP string directly from the worker source — no runtime needed.
// This catches regressions at lint/CI time before deploy.
const workerSource = readFileSync(
  resolve(process.cwd(), 'src/worker/index.ts'),
  'utf-8',
);

function extractDirective(csp: string, directive: string): string {
  // The worker source has each directive as one long quoted string per line:
  //   "script-src 'self' ... ; " +
  //   "connect-src 'self' ... ; " +
  // Split on the TypeScript string concat boundaries and find the matching token.
  const segments = csp.split(/"\s*\+\s*\n\s*"/);
  const found = segments.find(s => {
    const trimmed = s.replace(/^[\s"]+/, '').trimEnd();
    return trimmed.startsWith(`${directive} `) || trimmed.startsWith(`${directive}'`);
  });
  return found ?? '';
}

// Pull the full CSP from addSecurityHeaders
const cspBlockMatch = workerSource.match(/headers\.set\('Content-Security-Policy',\s*([\s\S]+?)\);\s*\n/);
const cspBlock = cspBlockMatch?.[1] ?? '';


describe('CSP: YouTube Live requirements', () => {
  it('script-src includes s.ytimg.com', () => {
    const line = extractDirective(cspBlock, 'script-src');
    expect(line).toContain('https://s.ytimg.com');
  });

  it('script-src-elem includes s.ytimg.com', () => {
    const line = extractDirective(cspBlock, 'script-src-elem');
    expect(line).toContain('https://s.ytimg.com');
  });

  it('script-src includes www.youtube.com', () => {
    const line = extractDirective(cspBlock, 'script-src');
    expect(line).toContain('https://www.youtube.com');
  });

  it('connect-src includes wss://www.youtube.com', () => {
    const line = extractDirective(cspBlock, 'connect-src');
    expect(line).toContain('wss://www.youtube.com');
  });

  it('connect-src includes jnn-pa.googleapis.com', () => {
    const line = extractDirective(cspBlock, 'connect-src');
    expect(line).toContain('https://jnn-pa.googleapis.com');
  });

  it('connect-src includes *.googlevideo.com', () => {
    const line = extractDirective(cspBlock, 'connect-src');
    expect(line).toContain('https://*.googlevideo.com');
  });

  it('frame-src includes www.youtube.com', () => {
    const line = extractDirective(cspBlock, 'frame-src');
    expect(line).toContain('https://www.youtube.com');
  });

  it('frame-src includes www.youtube-nocookie.com', () => {
    const line = extractDirective(cspBlock, 'frame-src');
    expect(line).toContain('https://www.youtube-nocookie.com');
  });

  it('media-src includes s.ytimg.com', () => {
    const line = extractDirective(cspBlock, 'media-src');
    expect(line).toContain('https://s.ytimg.com');
  });

  it('worker-src includes blob:', () => {
    const line = extractDirective(cspBlock, 'worker-src');
    expect(line).toContain("blob:");
  });
});

describe('CSP: Facebook is fully blocked', () => {
  const FB_DOMAINS = ['facebook.com', 'fbcdn.net', 'facebook.net', 'connect.facebook'];

  for (const domain of FB_DOMAINS) {
    it(`CSP does not allow ${domain}`, () => {
      const directives = ['script-src', 'script-src-elem', 'connect-src', 'frame-src', 'media-src', 'child-src'];
      for (const dir of directives) {
        const line = extractDirective(cspBlock, dir);
        expect(line).not.toContain(domain);
      }
    });
  }
});

describe('redeemAccessCode argument order', () => {
  const playerSource = readFileSync(
    resolve(process.cwd(), 'src/components/LiveStreamPlayer.tsx'),
    'utf-8',
  );

  it('captchaToken options object comes before null token arg', () => {
    const callMatch = playerSource.match(/redeemAccessCode\(\s*([\s\S]+?)\);/g);
    expect(callMatch).not.toBeNull();

    for (const call of callMatch ?? []) {
      const optionsPos = call.indexOf('captchaToken');
      const nullPos = call.lastIndexOf('null');
      if (optionsPos !== -1 && nullPos !== -1) {
        expect(optionsPos).toBeLessThan(nullPos);
      }
    }
  });
});

describe('SW: External player APIs use NetworkOnly', () => {
  const viteSource = readFileSync(
    resolve(process.cwd(), 'vite.config.ts'),
    'utf-8',
  );

  it('NetworkOnly handler is defined for YouTube iframe_api', () => {
    expect(viteSource).toContain('iframe_api');
    expect(viteSource).toContain("handler: 'NetworkOnly'");
  });

  it('s.ytimg.com is in NetworkOnly exemption', () => {
    const ytimgPos = viteSource.indexOf('s.ytimg.com');
    const networkOnlyPos = viteSource.indexOf("handler: 'NetworkOnly'");
    expect(networkOnlyPos - ytimgPos).toBeLessThan(800);
    expect(networkOnlyPos - ytimgPos).toBeGreaterThan(-50);
  });
});
