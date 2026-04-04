import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Static verification that routes are registered in the Worker route table.
// We can't call these handlers in test because they require a real Supabase connection.
const workerSource = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const publicRouteSource = readFileSync(resolve(__dirname, '../worker/routes/public.ts'), 'utf-8');

describe('public API route registration', () => {
  it('registers GET /api/public/home', () => {
    expect(workerSource).toContain('"/api/public/home"');
    expect(workerSource).toContain('handler: handlePublicHome');
  });

  it('registers GET /api/public/schedule', () => {
    expect(workerSource).toContain('"/api/public/schedule"');
    expect(workerSource).toContain('handler: handlePublicSchedule');
  });

  it('registers GET /api/public/potg', () => {
    expect(workerSource).toContain('"/api/public/potg"');
    expect(workerSource).toContain('handler: handlePublicPotg');
  });

  it('handlePublicSchedule handler is defined in routes/public.ts', () => {
    expect(publicRouteSource).toMatch(/export async function handlePublicSchedule/);
  });

  it('handlePublicPotg handler is defined in routes/public.ts', () => {
    expect(publicRouteSource).toMatch(/export async function handlePublicPotg/);
  });
});
