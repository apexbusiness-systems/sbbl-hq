/**
 * Regression tests for `resolveUserRoles`.
 *
 * Incident (2026-04-17): super_admin `jrmendozaceo@apexbusiness-systems.com`
 * was locked out of /api/leaderboards despite having
 * `user_role_assignments.role = 'super_admin'`. Root cause: the worker's
 * `getSession` read `payload.user_role` from the JWT, but Supabase Auth does
 * NOT embed that custom claim by default. Every privileged account silently
 * fell back to `["fan"]`.
 *
 * This file pins the fix: the worker MUST look up
 * `user_role_assignments` when the JWT lacks the claim, and merge roles
 * from both sources. Anyone who regresses this will turn these tests red.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUserRoles } from '@/worker/index';

function makeAdmin(options: {
  dbRoles?: string[];
  throwOnQuery?: boolean;
} = {}): SupabaseClient {
  const { dbRoles = [], throwOnQuery = false } = options;
  // PostgrestFilterBuilder is a Promises/A+ thenable. Our stub mirrors
  // that contract so `await admin.from(...).select(...).eq(...)` behaves
  // exactly like the real client.
  const chain = {
    select(_cols: string) {
      return chain;
    },
    eq(_col: string, _val: string) {
      return chain;
    },
    then(
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      if (throwOnQuery) {
        if (reject) reject(new Error('db offline'));
        return;
      }
      resolve({
        data: dbRoles.map((role) => ({ role })),
        error: null,
      });
    },
  };
  const admin = {
    from(_table: string) {
      return chain;
    },
  };
  return admin as unknown as SupabaseClient;
}

describe('resolveUserRoles', () => {
  it('looks up user_role_assignments when JWT has no user_role claim', async () => {
    const admin = makeAdmin({ dbRoles: ['super_admin'] });
    const roles = await resolveUserRoles(admin, 'u-super', undefined);
    expect(roles).toContain('super_admin');
    expect(roles).not.toContain('fan'); // no fan fallback if we found roles
  });

  it('merges JWT role with DB role (deduped)', async () => {
    const admin = makeAdmin({ dbRoles: ['coach'] });
    const roles = await resolveUserRoles(admin, 'u-coach', 'coach');
    expect(roles.filter((r) => r === 'coach')).toHaveLength(1);
  });

  it('honours JWT array user_role claim', async () => {
    const admin = makeAdmin({ dbRoles: [] });
    const roles = await resolveUserRoles(admin, 'u', ['coach', 'team_manager']);
    expect(roles.sort()).toEqual(['coach', 'team_manager']);
  });

  it('falls back to ["fan"] when neither JWT nor DB supply roles', async () => {
    const admin = makeAdmin({ dbRoles: [] });
    const roles = await resolveUserRoles(admin, 'u-anon', undefined);
    expect(roles).toEqual(['fan']);
  });

  it('falls back to JWT role when DB lookup throws', async () => {
    const admin = makeAdmin({ throwOnQuery: true });
    const roles = await resolveUserRoles(admin, 'u', 'coach');
    expect(roles).toEqual(['coach']); // DB failed, JWT still used
  });

  it('falls back to ["fan"] when DB throws and JWT is empty', async () => {
    const admin = makeAdmin({ throwOnQuery: true });
    const roles = await resolveUserRoles(admin, 'u', undefined);
    expect(roles).toEqual(['fan']);
  });

  it('ignores empty-string JWT role', async () => {
    const admin = makeAdmin({ dbRoles: ['super_admin'] });
    const roles = await resolveUserRoles(admin, 'u', '   ');
    expect(roles).toEqual(['super_admin']); // whitespace-only JWT is ignored
  });

  it('grants super_admin the FULL_STAT_ROLES membership by returning the role string', async () => {
    // This is the regression case for jrmendozaceo.
    const admin = makeAdmin({ dbRoles: ['super_admin'] });
    const roles = await resolveUserRoles(admin, 'u-jrm', undefined);
    const FULL_STAT_ROLES = new Set(['super_admin', 'league_admin', 'coach', 'team_manager']);
    expect(roles.some((r) => FULL_STAT_ROLES.has(r))).toBe(true);
  });
});
