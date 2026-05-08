import { describe, expect, it } from 'vitest';
import {
  applyGameEvent,
  createInitialGameProjection,
  rebuildCareerStats,
  rebuildGameProjection,
  rebuildStandings,
  type BasketballLedgerEvent,
} from '@/lib/events/basketball';
import { buildSyntheticBasketballEvents, simulateShadowParity } from '@/lib/events/simulation';

const base = {
  gameId: 'game-1',
  actorId: 'operator-1',
  source: 'operator' as const,
  createdAt: '2026-05-08T00:00:00.000Z',
};

function event(sequence: number, type: BasketballLedgerEvent['type'], payload: BasketballLedgerEvent['payload'] = {}): BasketballLedgerEvent {
  return {
    ...base,
    id: `event-${sequence}`,
    sequence,
    revision: sequence,
    type,
    payload,
    idempotencyKey: `idem-${sequence}`,
  };
}

describe('shadow basketball event reducer', () => {
  it('applies all core basketball and broadcast event types deterministically', () => {
    const events: BasketballLedgerEvent[] = [
      event(1, 'game_started'),
      event(2, 'period_started', { period: 1 }),
      event(3, 'clock_set', { clockSeconds: 480 }),
      event(4, 'clock_started'),
      event(5, 'clock_stopped', { clockSeconds: 470 }),
      event(6, 'score_adjusted', { side: 'home', points: 2 }),
      event(7, 'foul_assessed', { side: 'away' }),
      event(8, 'timeout_taken', { side: 'home' }),
      event(9, 'possession_changed', { possession: 'away' }),
      event(10, 'stat_recorded', { playerId: 'player-1', stat: 'pts', amount: 2 }),
      event(11, 'substitution', { playerId: 'player-2' }),
      event(12, 'sponsor_marker', { sponsorId: 'sponsor-1', label: 'bug' }),
      event(13, 'broadcast_marker', { markerType: 'lower-third', label: 'Player card' }),
      event(14, 'score_correction', { side: 'home', set: 3 }),
      event(15, 'event_voided', { voidedEventId: 'missing-event' }),
      event(16, 'game_finalized'),
    ];

    const projection = rebuildGameProjection('game-1', events);

    expect(projection).toMatchObject({
      status: 'final',
      sequence: 16,
      revision: 16,
      period: 1,
      clockSeconds: 470,
      clockRunning: false,
      homeScore: 3,
      awayScore: 0,
      awayFouls: 1,
      homeTimeoutsLeft: 4,
      possession: 'away',
    });
    expect(projection.players['player-1'].pts).toBe(2);
    expect(projection.markers).toHaveLength(1);
    expect(projection.sponsorExposures).toHaveLength(1);
  });

  it('is side-effect free and does not mutate the input state', () => {
    const initial = createInitialGameProjection('game-1');
    const frozen = structuredClone(initial);
    const next = applyGameEvent(initial, event(1, 'score_adjusted', { side: 'home', points: 2 }));

    expect(initial).toEqual(frozen);
    expect(next.homeScore).toBe(2);
    expect(next).not.toBe(initial);
  });

  it('ignores voided scored events during rebuild', () => {
    const projection = rebuildGameProjection('game-1', [
      event(1, 'score_adjusted', { side: 'home', points: 3 }),
      event(2, 'event_voided', { voidedEventId: 'event-1' }),
      event(3, 'score_adjusted', { side: 'away', points: 2 }),
    ]);

    expect(projection.homeScore).toBe(0);
    expect(projection.awayScore).toBe(2);
    expect(projection.voidedEventIds).toContain('event-1');
  });

  it('rebuilds standings and career stat projections from game projections', () => {
    const projection = rebuildGameProjection('game-1', [
      event(1, 'game_started'),
      event(2, 'score_adjusted', { side: 'home', points: 5 }),
      event(3, 'score_adjusted', { side: 'away', points: 4 }),
      event(4, 'stat_recorded', { playerId: 'player-1', stat: 'reb', amount: 7 }),
      event(5, 'game_finalized'),
    ]);

    const standings = rebuildStandings({ 'game-1': { homeTeamId: 'home', awayTeamId: 'away' } }, [projection]);
    const career = rebuildCareerStats('player-1', [projection]);

    expect(standings[0]).toMatchObject({ teamId: 'home', wins: 1, pointsFor: 5, pointsAgainst: 4 });
    expect(career).toMatchObject({ subjectId: 'player-1', gamesPlayed: 1, reb: 7 });
  });

  it('produces a deterministic shadow parity summary for fixture replay', () => {
    expect(buildSyntheticBasketballEvents()).toHaveLength(16);
    expect(simulateShadowParity()).toMatchObject({ passed: 1, mismatched: 0, unresolved: 0 });
  });
});
