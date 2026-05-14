import { describe, it, expect } from 'vitest';
import { makeJoinCode } from '../routes/engagement';

describe('makeJoinCode', () => {
  it('should generate a 6-character code', () => {
    const code = makeJoinCode();
    expect(code).toHaveLength(6);
  });

  it('should only contain characters from the allowed alphabet', () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = makeJoinCode();
    for (const char of code) {
      expect(alphabet).toContain(char);
    }
  });

  it('should generate different codes on subsequent calls', () => {
    const code1 = makeJoinCode();
    const code2 = makeJoinCode();
    expect(code1).not.toBe(code2);
  });
});
