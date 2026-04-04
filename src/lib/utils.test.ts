import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges basic string classes', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('resolves tailwind class conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
  });

  it('supports array inputs', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('supports object inputs', () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe('class1 class3');
  });

  it('ignores falsy values', () => {
    expect(cn('class1', null, undefined, false, 0, '', 'class2')).toBe('class1 class2');
  });

  it('handles complex nested structures', () => {
    const isActive = true;
    const isHovered = false;

    expect(
      cn(
        'base-class px-4 py-2',
        ['nested-class', { 'active-state': isActive, 'hover-state': isHovered }],
        'bg-red-500 text-white',
        'bg-blue-500' // Should override bg-red-500
      )
    ).toBe('base-class px-4 py-2 nested-class active-state text-white bg-blue-500');
  });
});
