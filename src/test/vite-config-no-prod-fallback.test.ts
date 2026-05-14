import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard: the Vite config must NEVER carry a committed production
 * Supabase URL or anon key as a fallback. Hardcoded prod fallbacks caused
 * silent split-brain — the bundle would boot against the committed project
 * even when /api/public-config pointed at a different one.
 *
 * Allowed values for these constants:
 *   - empty string ('' or "")
 *   - a reference to the loaded `env.VITE_*` variable
 * Forbidden values:
 *   - any inline https://*.supabase.co literal
 *   - any inline JWT-shaped literal (eyJ...)
 */
describe('vite.config.ts — no committed Supabase production fallbacks', () => {
  const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

  it('does not contain a literal supabase.co URL', () => {
    const hasInlineSupabaseUrl = /['"]https?:\/\/[a-z0-9-]+\.supabase\.co['"]/i.test(viteConfig);
    expect(hasInlineSupabaseUrl).toBe(false);
  });

  it('does not contain a literal JWT-shaped Supabase anon/publishable key', () => {
    // Supabase keys start with eyJ (a base64-encoded JWT header). A short
    // ASCII identifier-only check avoids false positives on imports/aliases.
    const hasJwt = /['"]eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+['"]/.test(viteConfig);
    expect(hasJwt).toBe(false);
  });

  it('still wires VITE_SUPABASE_URL and key into define() so explicit env reaches the bundle', () => {
    expect(viteConfig).toMatch(/'import\.meta\.env\.VITE_SUPABASE_URL'/);
    expect(viteConfig).toMatch(/'import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY'/);
  });
});
