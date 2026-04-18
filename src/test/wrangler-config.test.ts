/**
 * wrangler-config.test.ts
 *
 * Regression shield for wrangler.jsonc deployment config.
 *
 * The 2026-04-18 Twitch autoplay outage had a second layer: even once the
 * Worker emitted the correct Permissions-Policy / CSP headers, those headers
 * never reached the browser on SPA pages (`/live`, `/`, `/stats`, …) because
 * `run_worker_first` was set to a path list (`["/api/*", "/auth/*", …]`) that
 * excluded HTML routes. Cloudflare served those HTML responses straight from
 * the static-asset binding, bypassing the Worker's addSecurityHeaders().
 *
 * This test pins `run_worker_first: true` so the Worker is guaranteed to run
 * for every request — including SPA HTML, which is where browsers read
 * Permissions-Policy to gate cross-origin iframe autoplay (Twitch/YT/Vimeo).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadWranglerConfig(): Record<string, unknown> {
  // vitest runs from the project root, so cwd resolves cleanly in ESM mode
  // where __dirname is not available.
  const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
  // Strip // comments and trailing commas — wrangler accepts JSONC, JSON.parse does not.
  const stripped = raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped) as Record<string, unknown>;
}

describe('wrangler.jsonc — deployment contract', () => {
  it('runs the Worker for every request so SPA HTML receives security headers', () => {
    const cfg = loadWranglerConfig();
    const assets = cfg.assets as Record<string, unknown> | undefined;
    expect(assets, 'wrangler.jsonc must define an `assets` binding').toBeDefined();
    // Must be the boolean `true` — not a path list. A list causes Cloudflare
    // to serve unlisted routes (like /live) directly from the static-asset
    // binding, bypassing the Worker and stripping every security header.
    expect(
      assets!.run_worker_first,
      'run_worker_first must be `true` so /live HTML flows through addSecurityHeaders',
    ).toBe(true);
  });

  it('keeps SPA fallback enabled so client-side routes resolve to index.html', () => {
    const cfg = loadWranglerConfig();
    const assets = cfg.assets as Record<string, unknown>;
    expect(assets.not_found_handling).toBe('single-page-application');
  });

  it('pins the production worker name (custom domains + secrets are bound to it)', () => {
    const cfg = loadWranglerConfig();
    expect(cfg.name).toBe('sbbl-hq-worker');
  });
});
