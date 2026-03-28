import { describe, expect, it } from 'vitest';
import { canAccessOps, hasRole } from '@/lib/auth/roles';

describe('role guards', () => {
  it('allows admins and super admins into ops', () => {
    expect(canAccessOps(['league_admin'] as never)).toBe(true);
    expect(canAccessOps(['super_admin'] as never)).toBe(true);
  });

  it('blocks fans from ops', () => {
    expect(canAccessOps(['fan'] as never)).toBe(false);
    expect(hasRole(['fan'] as never, 'league_admin')).toBe(false);
  });
});
