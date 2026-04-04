export const APP_ROLES = [
  'fan',
  'paid_fan',  // registered fan who has purchased PPV access; may generate 1 invite/game
  'player',
  'coach',     // team coach; free role, requires super-admin approval
  'team_manager',
  'league_admin',
  'media_operator',
  'store_operator',
  'super_admin',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

const hierarchy: Record<AppRole, number> = {
  fan: 1,
  paid_fan: 1,       // peer to fan; distinguished by invite-generation privilege
  player: 2,
  coach: 3,
  team_manager: 3,
  media_operator: 3,
  store_operator: 3,
  league_admin: 4,
  super_admin: 5,
};

export function hasRole(userRoles: AppRole[], required: AppRole) {
  return userRoles.some((role) => hierarchy[role] >= hierarchy[required]);
}

export function canAccessOps(userRoles: AppRole[]) {
  return hasRole(userRoles, 'league_admin');
}

export function assertRole(userRoles: AppRole[], required: AppRole) {
  if (!hasRole(userRoles, required)) {
    throw new Error(`forbidden: requires ${required}`);
  }
}
