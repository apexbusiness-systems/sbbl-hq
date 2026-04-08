import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_CONSENT, readConsent, resetLocalMemory, writeConsent } from '@/lib/consent';

describe('consent store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to opt-out consent', () => {
    expect(readConsent()).toEqual(DEFAULT_CONSENT);
  });

  it('writes and reads consent values', () => {
    writeConsent({ ...DEFAULT_CONSENT, localMemoryEnabled: true, cloudSyncEnabled: true });
    expect(readConsent().localMemoryEnabled).toBe(true);
    expect(readConsent().cloudSyncEnabled).toBe(true);
  });

  it('resets consent and local memory keys', () => {
    localStorage.setItem('sbbl:consent:v1', '{}');
    localStorage.setItem('sbbl:guest-mode', 'true');
    localStorage.setItem('sbbl:history:test', 'a');
    resetLocalMemory();
    expect(localStorage.getItem('sbbl:consent:v1')).toBeNull();
    expect(localStorage.getItem('sbbl:guest-mode')).toBeNull();
    expect(localStorage.getItem('sbbl:history:test')).toBeNull();
  });
});
