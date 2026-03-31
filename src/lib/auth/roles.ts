export const APP_ROLES = [
  'fan',
  'player',
  'coach',
  'team_manager',
  'league_admin',
  'media_operator',
  'store_operator',
  'super_admin',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

const hierarchy: Record<AppRole, number> = {
  fan: 1,
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

// Player specific
export function canUpdateBio(userRoles: AppRole[]) { return hasRole(userRoles, 'player'); }
export function canCheckIn(userRoles: AppRole[]) { return hasRole(userRoles, 'player'); }

// Coach specific
export function canSetTeamEvents(userRoles: AppRole[]) { return hasRole(userRoles, 'coach'); }

// Admin specific (includes super admin via hierarchy)
export function canScanQR(userRoles: AppRole[]) { return hasRole(userRoles, 'league_admin'); }
export function canUploadStoreInventory(userRoles: AppRole[]) { return hasRole(userRoles, 'league_admin'); }
export function canEditMedia(userRoles: AppRole[]) { return hasRole(userRoles, 'league_admin'); }
export function canEditEvents(userRoles: AppRole[]) { return hasRole(userRoles, 'league_admin'); }
export function canSetPaywall(userRoles: AppRole[]) { return hasRole(userRoles, 'league_admin'); }

// Super Admin exclusive
export function canSetPricing(userRoles: AppRole[]) { return hasRole(userRoles, 'super_admin'); }
export function canUploadSaleItems(userRoles: AppRole[]) { return hasRole(userRoles, 'super_admin'); }
export function canModerateUsers(userRoles: AppRole[]) { return hasRole(userRoles, 'super_admin'); } // Suspend/ban
export function canControlLiveStreams(userRoles: AppRole[]) { return hasRole(userRoles, 'super_admin'); } // Start/end streams
