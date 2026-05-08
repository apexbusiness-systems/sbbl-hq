import { simulateShadowParity } from '../src/lib/events/simulation';

const summary = simulateShadowParity();
console.log(JSON.stringify({
  passed: summary.passed,
  mismatched: summary.mismatched,
  unresolved: summary.unresolved,
  projection: {
    gameId: summary.projection.gameId,
    sequence: summary.projection.sequence,
    status: summary.projection.status,
    homeScore: summary.projection.homeScore,
    awayScore: summary.projection.awayScore,
  },
}, null, 2));
