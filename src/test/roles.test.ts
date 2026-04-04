import { describe, expect, it } from 'vitest';
import { APP_ROLES, hasRole, canAccessOps, assertRole, type AppRole } from '@/lib/auth/roles';

describe('role system', () => {
  it('includes all expected roles', () => {
    expect(APP_ROLES).toContain('fan');
    expect(APP_ROLES).toContain('paid_fan');
    expect(APP_ROLES).toContain('player');
    expect(APP_ROLES).toContain('coach');
    expect(APP_ROLES).toContain('team_manager');
    expect(APP_ROLES).toContain('league_admin');
    expect(APP_ROLES).toContain('super_admin');
  });

  it('coach is at level 3 (same as team_manager)', () => {
    // coach can satisfy team_manager requirement (same hierarchy level)
    expect(hasRole(['coach'], 'team_manager')).toBe(true);
    expect(hasRole(['team_manager'], 'coach')).toBe(true);
  });

  it('coach cannot access ops (requires league_admin)', () => {
    expect(canAccessOps(['coach'])).toBe(false);
    expect(canAccessOps(['league_admin'])).toBe(true);
    expect(canAccessOps(['super_admin'])).toBe(true);
  });

  it('fan is lowest level', () => {
    expect(hasRole(['fan'], 'fan')).toBe(true);
    expect(hasRole(['fan'], 'player')).toBe(false);
    expect(hasRole(['fan'], 'coach')).toBe(false);
    expect(hasRole(['fan'], 'league_admin')).toBe(false);
  });

  it('super_admin satisfies all role requirements', () => {
    const superAdminRoles: AppRole[] = ['super_admin'];
    expect(hasRole(superAdminRoles, 'fan')).toBe(true);
    expect(hasRole(superAdminRoles, 'player')).toBe(true);
    expect(hasRole(superAdminRoles, 'coach')).toBe(true);
    expect(hasRole(superAdminRoles, 'team_manager')).toBe(true);
    expect(hasRole(superAdminRoles, 'league_admin')).toBe(true);
    expect(hasRole(superAdminRoles, 'super_admin')).toBe(true);
  });

  it('assertRole throws for insufficient role', () => {
    expect(() => assertRole(['fan'], 'player')).toThrow('forbidden');
    expect(() => assertRole(['player'], 'league_admin')).toThrow('forbidden');
    expect(() => assertRole(['coach'], 'league_admin')).toThrow('forbidden');
  });

  it('assertRole does not throw for sufficient role', () => {
    expect(() => assertRole(['league_admin'], 'league_admin')).not.toThrow();
    expect(() => assertRole(['super_admin'], 'league_admin')).not.toThrow();
    expect(() => assertRole(['coach'], 'coach')).not.toThrow();
  });

  it('paid_fan can generate invites but not access ops', () => {
    expect(hasRole(['paid_fan'], 'paid_fan')).toBe(true);
    expect(canAccessOps(['paid_fan'])).toBe(false);
  });
});
