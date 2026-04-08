import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envExample = readFileSync(resolve(__dirname, '../../.env.example'), 'utf-8');
const devVarsExample = readFileSync(resolve(__dirname, '../../.dev.vars.example'), 'utf-8');
const wranglerConfig = readFileSync(resolve(__dirname, '../../wrangler.jsonc'), 'utf-8');
const supabaseClientSrc = readFileSync(resolve(__dirname, '../lib/supabase/client.ts'), 'utf-8');
const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');

describe('supabase env-system separation audit', () => {
  it('frontend .env example uses VITE anon/publishable keys only', () => {
    expect(envExample).toContain('VITE_SUPABASE_URL=');
    expect(envExample).toContain('VITE_SUPABASE_ANON_KEY=');
    expect(envExample).not.toContain('SUPABASE_SERVICE_ROLE_KEY=');
  });

  it('worker .dev.vars example keeps service role key out of frontend namespace', () => {
    expect(devVarsExample).toContain('SUPABASE_SERVICE_ROLE_KEY=');
    expect(devVarsExample).toContain('SUPABASE_PUBLISHABLE_KEY=');
    expect(devVarsExample).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY=');
  });

  it('wrangler config does not define service role in plaintext vars block', () => {
    expect(wranglerConfig).toContain('wrangler secret put <KEY>');
    expect(wranglerConfig).not.toContain('"SUPABASE_SERVICE_ROLE_KEY":');
  });

  it('frontend supabase client builds from publishable/anon key only', () => {
    expect(supabaseClientSrc).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(supabaseClientSrc).toContain('VITE_SUPABASE_ANON_KEY');
    expect(supabaseClientSrc).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('worker admin client consumes service role key from runtime env', () => {
    expect(workerSrc).toContain('createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY');
  });

  it('ops page does not embed service role key literals', () => {
    const opsPageSrc = readFileSync(resolve(__dirname, '../pages/Ops.tsx'), 'utf-8');
    expect(opsPageSrc).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(opsPageSrc).not.toContain('service_role');
  });
});
