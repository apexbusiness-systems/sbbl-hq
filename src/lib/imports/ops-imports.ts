export type LeagueReference = {
  id: string;
  code: string;
  name: string;
};

export type SeasonReference = {
  id: string;
  name: string;
  league_id: string;
};

export type DivisionReference = {
  id: string;
  name: string;
  season_id: string;
};

export type VenueReference = {
  id: string;
  name: string;
};

export type CourtReference = {
  id: string;
  name: string;
  venue_id: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEAGUE_CODE_ALIASES: Record<string, string> = {
  sbbl: 'SBBL',
  wbl: 'WBL',
  tgif: 'TGIFBL',
  tgifbl: 'TGIFBL',
};

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value.trim()));
}

export function firstNonEmptyValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function findLeagueReference(leagues: LeagueReference[], value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUuid(trimmed)) {
    return leagues.find((league) => league.id === trimmed) ?? null;
  }

  const normalized = normalizeLookupValue(trimmed);
  const aliasCode = LEAGUE_CODE_ALIASES[normalized];
  const uppercase = String(trimmed).toUpperCase();

  return leagues.find((league) => {
    const code = league.code.toUpperCase();
    return code === uppercase
      || code === aliasCode
      || normalizeLookupValue(league.name) === normalized;
  }) ?? null;
}

export function findSeasonReference(seasons: SeasonReference[], leagueId: string, value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUuid(trimmed)) {
    return seasons.find((season) => season.id === trimmed) ?? null;
  }

  const normalized = normalizeLookupValue(trimmed);
  return seasons.find((season) => season.league_id === leagueId && normalizeLookupValue(season.name) === normalized) ?? null;
}

export function findDivisionReference(divisions: DivisionReference[], seasonId: string, value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUuid(trimmed)) {
    return divisions.find((division) => division.id === trimmed) ?? null;
  }

  const normalized = normalizeLookupValue(trimmed);
  return divisions.find((division) => division.season_id === seasonId && normalizeLookupValue(division.name) === normalized) ?? null;
}

export function findVenueReference(venues: VenueReference[], value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUuid(trimmed)) {
    return venues.find((venue) => venue.id === trimmed) ?? null;
  }

  const normalized = normalizeLookupValue(trimmed);
  return venues.find((venue) => normalizeLookupValue(venue.name) === normalized) ?? null;
}

export function findCourtReference(courts: CourtReference[], venueId: string, value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUuid(trimmed)) {
    return courts.find((court) => court.id === trimmed) ?? null;
  }

  const normalized = normalizeLookupValue(trimmed);
  return courts.find((court) => court.venue_id === venueId && normalizeLookupValue(court.name) === normalized) ?? null;
}
