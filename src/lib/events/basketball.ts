export type TeamSide = 'home' | 'away';

export type BasketballEventType =
  | 'game_started'
  | 'period_started'
  | 'clock_set'
  | 'clock_started'
  | 'clock_stopped'
  | 'score_adjusted'
  | 'foul_assessed'
  | 'timeout_taken'
  | 'possession_changed'
  | 'stat_recorded'
  | 'substitution'
  | 'sponsor_marker'
  | 'broadcast_marker'
  | 'score_correction'
  | 'event_voided'
  | 'game_finalized';

export type BasketballEventPayload = {
  side?: TeamSide;
  points?: number;
  delta?: number;
  set?: number;
  period?: number;
  clockSeconds?: number;
  playerId?: string;
  teamId?: string;
  stat?: 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'fls' | 'min';
  amount?: number;
  possession?: TeamSide | 'none';
  reason?: string;
  label?: string;
  sponsorId?: string;
  markerType?: string;
  supersedesEventId?: string;
  voidedEventId?: string;
  [key: string]: unknown;
};

export type BasketballLedgerEvent = {
  id: string;
  gameId: string;
  sequence: number;
  revision: number;
  type: BasketballEventType;
  payload: BasketballEventPayload;
  actorId?: string | null;
  source: 'operator' | 'scorekeeper' | 'webhook' | 'system' | 'simulation';
  createdAt: string;
  idempotencyKey: string;
  supersedesEventId?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
};

export type PlayerStatLine = {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fls: number;
  min: number;
};

export type GameProjectionState = {
  gameId: string;
  sequence: number;
  revision: number;
  status: 'scheduled' | 'live' | 'final';
  period: number;
  clockSeconds: number;
  clockRunning: boolean;
  possession: TeamSide | 'none';
  homeScore: number;
  awayScore: number;
  homeFouls: number;
  awayFouls: number;
  homeTimeoutsLeft: number;
  awayTimeoutsLeft: number;
  players: Record<string, PlayerStatLine>;
  markers: Array<{ eventId: string; type: string; label: string; sequence: number }>;
  sponsorExposures: Array<{ eventId: string; sponsorId: string; label: string; sequence: number }>;
  voidedEventIds: string[];
};

export type StandingProjection = {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type CareerProjection = PlayerStatLine & { subjectId: string; gamesPlayed: number };

export function createInitialGameProjection(gameId: string): GameProjectionState {
  return {
    gameId,
    sequence: 0,
    revision: 0,
    status: 'scheduled',
    period: 1,
    clockSeconds: 600,
    clockRunning: false,
    possession: 'none',
    homeScore: 0,
    awayScore: 0,
    homeFouls: 0,
    awayFouls: 0,
    homeTimeoutsLeft: 5,
    awayTimeoutsLeft: 5,
    players: {},
    markers: [],
    sponsorExposures: [],
    voidedEventIds: [],
  };
}

function clampWhole(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function statLine(): PlayerStatLine {
  return { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fls: 0, min: 0 };
}

function withHeader(state: GameProjectionState, event: BasketballLedgerEvent): GameProjectionState {
  return {
    ...state,
    sequence: Math.max(state.sequence, event.sequence),
    revision: Math.max(state.revision, event.revision),
  };
}

export function applyGameEvent(
  state: GameProjectionState,
  event: BasketballLedgerEvent,
): GameProjectionState {
  if (event.voidedAt || state.voidedEventIds.includes(event.id)) {
    return withHeader(state, event);
  }

  const next = withHeader(state, event);
  const payload = event.payload ?? {};
  const side = payload.side;

  switch (event.type) {
    case 'game_started':
      return { ...next, status: 'live', clockRunning: false };
    case 'period_started':
      return {
        ...next,
        period: clampWhole(payload.period, next.period),
        homeFouls: 0,
        awayFouls: 0,
        clockRunning: false,
      };
    case 'clock_set':
      return { ...next, clockSeconds: clampWhole(payload.clockSeconds, next.clockSeconds), clockRunning: false };
    case 'clock_started':
      return { ...next, clockRunning: true };
    case 'clock_stopped':
      return { ...next, clockSeconds: clampWhole(payload.clockSeconds, next.clockSeconds), clockRunning: false };
    case 'score_adjusted':
    case 'score_correction': {
      if (side !== 'home' && side !== 'away') return next;
      const key = side === 'home' ? 'homeScore' : 'awayScore';
      const current = next[key];
      const value = typeof payload.set === 'number'
        ? clampWhole(payload.set)
        : clampWhole(current + Number(payload.delta ?? payload.points ?? 0));
      return { ...next, [key]: value };
    }
    case 'foul_assessed': {
      if (side !== 'home' && side !== 'away') return next;
      const key = side === 'home' ? 'homeFouls' : 'awayFouls';
      return { ...next, [key]: clampWhole(next[key] + Number(payload.delta ?? 1)) };
    }
    case 'timeout_taken': {
      if (side !== 'home' && side !== 'away') return next;
      const key = side === 'home' ? 'homeTimeoutsLeft' : 'awayTimeoutsLeft';
      return { ...next, [key]: clampWhole(next[key] - 1) };
    }
    case 'possession_changed':
      return payload.possession === 'home' || payload.possession === 'away' || payload.possession === 'none'
        ? { ...next, possession: payload.possession }
        : next;
    case 'stat_recorded': {
      if (!payload.playerId || !payload.stat) return next;
      const current = next.players[payload.playerId] ?? statLine();
      const amount = typeof payload.amount === 'number' && Number.isFinite(payload.amount) ? payload.amount : 1;
      return {
        ...next,
        players: {
          ...next.players,
          [payload.playerId]: { ...current, [payload.stat]: Math.max(0, current[payload.stat] + amount) },
        },
      };
    }
    case 'substitution':
      return next;
    case 'broadcast_marker':
      return {
        ...next,
        markers: [...next.markers, {
          eventId: event.id,
          type: String(payload.markerType ?? 'manual'),
          label: String(payload.label ?? event.type),
          sequence: event.sequence,
        }],
      };
    case 'sponsor_marker':
      return payload.sponsorId
        ? {
            ...next,
            sponsorExposures: [...next.sponsorExposures, {
              eventId: event.id,
              sponsorId: payload.sponsorId,
              label: String(payload.label ?? 'sponsor_marker'),
              sequence: event.sequence,
            }],
          }
        : next;
    case 'event_voided':
      return payload.voidedEventId
        ? { ...next, voidedEventIds: [...new Set([...next.voidedEventIds, payload.voidedEventId])] }
        : next;
    case 'game_finalized':
      return { ...next, status: 'final', clockRunning: false };
    default: {
      const exhaustive: never = event.type;
      return exhaustive;
    }
  }
}

export function rebuildGameProjection(gameId: string, events: BasketballLedgerEvent[]): GameProjectionState {
  const ordered = [...events]
    .filter((event) => event.gameId === gameId)
    .sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));

  const voided = new Set(
    ordered
      .filter((event) => event.type === 'event_voided' && event.payload.voidedEventId)
      .map((event) => String(event.payload.voidedEventId)),
  );

  return ordered.reduce((state, event) => {
    if (voided.has(event.id) && event.type !== 'event_voided') {
      return { ...state, voidedEventIds: [...new Set([...state.voidedEventIds, event.id])] };
    }
    return applyGameEvent(state, event);
  }, createInitialGameProjection(gameId));
}

export function rebuildStandings(
  gameTeamMap: Record<string, { homeTeamId: string; awayTeamId: string }>,
  projections: GameProjectionState[],
): StandingProjection[] {
  const table = new Map<string, StandingProjection>();
  const row = (teamId: string) => table.get(teamId) ?? { teamId, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };

  for (const projection of projections.filter((item) => item.status === 'final')) {
    const teams = gameTeamMap[projection.gameId];
    if (!teams) continue;
    const home = row(teams.homeTeamId);
    const away = row(teams.awayTeamId);
    home.pointsFor += projection.homeScore;
    home.pointsAgainst += projection.awayScore;
    away.pointsFor += projection.awayScore;
    away.pointsAgainst += projection.homeScore;
    if (projection.homeScore > projection.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (projection.awayScore > projection.homeScore) {
      away.wins += 1;
      home.losses += 1;
    }
    table.set(home.teamId, home);
    table.set(away.teamId, away);
  }

  return [...table.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.pointsFor - a.pointsFor);
}

export function rebuildCareerStats(subjectId: string, projections: GameProjectionState[]): CareerProjection {
  const totals: CareerProjection = { subjectId, gamesPlayed: 0, ...statLine() };
  for (const projection of projections) {
    const line = projection.players[subjectId];
    if (!line) continue;
    totals.gamesPlayed += 1;
    totals.pts += line.pts;
    totals.reb += line.reb;
    totals.ast += line.ast;
    totals.stl += line.stl;
    totals.blk += line.blk;
    totals.fls += line.fls;
    totals.min += line.min;
  }
  return totals;
}
