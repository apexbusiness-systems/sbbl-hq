/**
 * Stamina zone thresholds + heart-rate danger — pure branch coverage.
 */
import { describe, expect, it } from 'vitest';
import { isHeartRateDanger, zoneForStamina } from '@/lib/biometrics/types';

describe('zoneForStamina', () => {
  it('green at 70% and above', () => {
    expect(zoneForStamina(100)).toBe('green');
    expect(zoneForStamina(70)).toBe('green');
  });

  it('gold from 69 down to 40', () => {
    expect(zoneForStamina(69)).toBe('gold');
    expect(zoneForStamina(55)).toBe('gold');
    expect(zoneForStamina(40)).toBe('gold');
  });

  it('red below 40', () => {
    expect(zoneForStamina(39)).toBe('red');
    expect(zoneForStamina(10)).toBe('red');
    expect(zoneForStamina(0)).toBe('red');
  });

  it('defaults to green when null/undefined (absent state is not a warning)', () => {
    expect(zoneForStamina(null)).toBe('green');
    expect(zoneForStamina(undefined)).toBe('green');
  });
});

describe('isHeartRateDanger', () => {
  it('flags > 180 BPM as danger', () => {
    expect(isHeartRateDanger(181)).toBe(true);
    expect(isHeartRateDanger(220)).toBe(true);
  });

  it('does not flag <= 180 BPM', () => {
    expect(isHeartRateDanger(180)).toBe(false);
    expect(isHeartRateDanger(140)).toBe(false);
    expect(isHeartRateDanger(0)).toBe(false);
  });

  it('does not flag null', () => {
    expect(isHeartRateDanger(null)).toBe(false);
    expect(isHeartRateDanger(undefined)).toBe(false);
  });
});
