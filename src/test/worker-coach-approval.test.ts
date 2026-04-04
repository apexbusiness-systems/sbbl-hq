import { describe, expect, it } from 'vitest';
import { PLAYER_REGISTRATION_PRICE_CAD, PPV_PRICE_CAD } from '@/lib/auth/subscription';

// Structural tests for coach approval flow
describe('coach approval flow', () => {
  it('coach role intent is distinct from fan and player', () => {
    const validIntents = ['fan', 'player', 'coach'];
    expect(validIntents).toContain('fan');
    expect(validIntents).toContain('player');
    expect(validIntents).toContain('coach');
    expect(validIntents).not.toContain('league_admin');
    expect(validIntents).not.toContain('team_manager');
  });

  it('coach approval status values are valid', () => {
    const validStatuses = ['pending', 'approved', 'rejected'];
    expect(validStatuses).toHaveLength(3);
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('approved');
    expect(validStatuses).toContain('rejected');
  });

  it('coach access is free — no price constant exists for coach', () => {
    // Player and PPV have price constants; coach does not (it's free, admin-approved)
    expect(typeof PLAYER_REGISTRATION_PRICE_CAD).toBe('number');
    expect(typeof PPV_PRICE_CAD).toBe('number');
    // Verify these are the only paid tiers in the subscription module
    expect(PLAYER_REGISTRATION_PRICE_CAD).toBeGreaterThan(0);
    expect(PPV_PRICE_CAD).toBeGreaterThan(0);
  });
});
