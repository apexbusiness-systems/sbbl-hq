import { rebuildCareerStats, rebuildGameProjection, rebuildStandings, type BasketballLedgerEvent } from './basketball';

const gameId = '00000000-0000-4000-8000-000000000001';
const homeTeamId = '00000000-0000-4000-8000-0000000000a1';
const awayTeamId = '00000000-0000-4000-8000-0000000000b1';
const createdAt = '2026-05-08T00:00:00.000Z';

function event(sequence: number, type: BasketballLedgerEvent['type'], payload: BasketballLedgerEvent['payload']): BasketballLedgerEvent {
  return {
    id: `evt-${sequence.toString().padStart(4, '0')}`,
    gameId,
    sequence,
    revision: sequence,
    type,
    payload,
    source: 'simulation',
    actorId: 'operator-1',
    createdAt,
    idempotencyKey: `sim-${sequence}`,
  };
}

export function buildSyntheticBasketballEvents(): BasketballLedgerEvent[] {
  return [
    event(1, 'game_started', {}),
    event(2, 'clock_set', { clockSeconds: 600 }),
    event(3, 'score_adjusted', { side: 'home', points: 2 }),
    event(4, 'stat_recorded', { playerId: 'home-p1', stat: 'pts', amount: 2 }),
    event(5, 'score_adjusted', { side: 'away', points: 3 }),
    event(6, 'stat_recorded', { playerId: 'away-p1', stat: 'pts', amount: 3 }),
    event(7, 'foul_assessed', { side: 'away' }),
    event(8, 'timeout_taken', { side: 'home' }),
    event(9, 'broadcast_marker', { markerType: 'score', label: 'Opening run' }),
    event(10, 'sponsor_marker', { sponsorId: 'sponsor-1', label: 'Q1 sponsor bug' }),
    event(11, 'period_started', { period: 2 }),
    event(12, 'score_adjusted', { side: 'home', points: 3 }),
    event(13, 'score_correction', { side: 'away', set: 2, reason: 'scorekeeper correction' }),
    event(14, 'event_voided', { voidedEventId: 'evt-0012' }),
    event(15, 'score_adjusted', { side: 'home', points: 2 }),
    event(16, 'game_finalized', {}),
  ];
}

export function simulateShadowParity() {
  const events = buildSyntheticBasketballEvents();
  const projection = rebuildGameProjection(gameId, events);
  const standings = rebuildStandings({ [gameId]: { homeTeamId, awayTeamId } }, [projection]);
  const career = rebuildCareerStats('home-p1', [projection]);
  const expected = { homeScore: 4, awayScore: 2, status: 'final' };
  const passed = projection.homeScore === expected.homeScore
    && projection.awayScore === expected.awayScore
    && projection.status === expected.status;

  return {
    passed: passed ? 1 : 0,
    mismatched: passed ? 0 : 1,
    unresolved: 0,
    projection,
    standings,
    career,
  };
}
