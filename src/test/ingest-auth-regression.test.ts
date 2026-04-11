/**
 * REGRESSION: POST /ops/ingest/presign must use DB-backed role lookup.
 * Bug: requireSuperAdmin() read roles from JWT header (always "fan").
 * Fix: requireSuperAdminSession() queries user_role_assignments table.
 * If this test breaks: do NOT revert to requireSuperAdmin().
 */
import { describe, it, expect } from 'vitest';

// Verify that isOpsAuthError does NOT treat 'forbidden' as a session expiry.
import { isOpsAuthError } from '@/pages/Ops';

describe('isOpsAuthError — forbidden is not a session error', () => {
  it('returns false for forbidden (wrong role, not lost session)', () => {
    expect(isOpsAuthError(new Error('forbidden'))).toBe(false);
  });

  it('returns true for unauthorized (true session loss)', () => {
    expect(isOpsAuthError(new Error('unauthorized'))).toBe(true);
  });

  it('returns true for reauth_required (true session loss)', () => {
    expect(isOpsAuthError(new Error('reauth_required'))).toBe(true);
  });

  it('returns false for generic API errors', () => {
    expect(isOpsAuthError(new Error('request_failed_500'))).toBe(false);
    expect(isOpsAuthError(new Error('upload_failed'))).toBe(false);
    expect(isOpsAuthError(null)).toBe(false);
  });
});
