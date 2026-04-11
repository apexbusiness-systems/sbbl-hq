import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('MediaLayoutGrid accessibility contract', () => {
  it('includes keyboard and touch sensors', () => {
    const source = readFileSync(resolve(__dirname, './MediaLayoutGrid.tsx'), 'utf-8');
    expect(source).toContain('KeyboardSensor');
    expect(source).toContain('TouchSensor');
    expect(source).toContain('PointerSensor');
  });
});
