import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerPath = resolve(__dirname, '../../wrangler.jsonc');

function stripJsonc(src: string): string {
  // Strip // line comments and /* block comments while preserving strings.
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  let stringQuote = '';
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringQuote) inString = false;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  // Remove trailing commas before ] or }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

describe('wrangler.jsonc configuration contract', () => {
  const raw = readFileSync(wranglerPath, 'utf8');
  const config = JSON.parse(stripJsonc(raw)) as {
    name?: string;
    assets?: { run_worker_first?: boolean | string[] };
  };

  it('keeps the pinned worker name so custom domains + secrets stay bound', () => {
    expect(config.name).toBe('sbbl-hq-worker');
  });

  // Regression guard: a previous commit set run_worker_first to a path allowlist
  // (["/api/*", "/auth/*", "/webhooks/*", "/ops/*"]). That routed SPA HTML
  // requests directly to the ASSETS binding, bypassing the Worker's
  // addSecurityHeaders() wrapper. The browser then received zero security
  // headers on /live and Twitch embed autoplay silently broke. Keep this `true`.
  it('runs the Worker first for ALL routes so security headers reach SPA HTML', () => {
    expect(config.assets?.run_worker_first).toBe(true);
  });
});
