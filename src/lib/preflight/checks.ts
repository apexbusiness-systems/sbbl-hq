/**
 * Viewer preflight — pure check functions.
 *
 * Every function in this module is pure: it takes a snapshot + some
 * browser-side capabilities and returns a CheckResult. This makes every
 * check unit-testable without jsdom, without a live DOM, and without a
 * live Supabase. The orchestrator component wires the side-effectful
 * sources (fetch, navigator, video probe) to these pure functions.
 */
import type {
  CheckResult,
  GameStreamState,
  PreflightSnapshot,
} from './types';

export interface BrowserCapabilities {
  /** navigator.userAgent */
  userAgent: string;
  /** navigator.connection.effectiveType, if available. */
  effectiveType?: '2g' | '3g' | '4g' | '5g' | 'wifi' | 'slow-2g' | string;
  /** Result of a silent muted-video canplay probe. */
  canAutoplayMutedVideo: boolean;
  /** True when the SW-level PWA APIs are available. */
  isPwaCapable: boolean;
}

/** Map a browser's userAgent to a qualitative assessment. */
function classifyBrowser(userAgent: string): 'modern' | 'older' | 'unknown' {
  const ua = userAgent.toLowerCase();
  // Chromium 100+, Safari 15+, Firefox 100+. A very rough cut — the aim
  // is to flag obviously old browsers, not to be a CanIUse replacement.
  const chromeMatch = ua.match(/chrome\/(\d+)/);
  if (chromeMatch && Number(chromeMatch[1]) >= 100) return 'modern';
  const safariMatch = ua.match(/version\/(\d+).*safari/);
  if (safariMatch && Number(safariMatch[1]) >= 15) return 'modern';
  const firefoxMatch = ua.match(/firefox\/(\d+)/);
  if (firefoxMatch && Number(firefoxMatch[1]) >= 100) return 'modern';
  if (chromeMatch || safariMatch || firefoxMatch) return 'older';
  return 'unknown';
}

// ── Individual checks ──────────────────────────────────────────────────────

export function checkAuth(snapshot: PreflightSnapshot): CheckResult {
  if (snapshot.userId) {
    return { id: 'auth', status: 'pass', label: 'Signed in' };
  }
  return {
    id: 'auth',
    status: 'fail',
    label: 'Sign in required',
    detail: 'You need an account to watch this game.',
    remediation: { cta: 'Sign in', action: 'sign_in' },
  };
}

export function checkEntitlement(snapshot: PreflightSnapshot): CheckResult {
  // Auth is a prerequisite — a signed-out user's entitlement check is
  // irrelevant until they sign in.
  if (!snapshot.userId) {
    return { id: 'entitlement', status: 'skipped', label: 'Access not yet checked' };
  }
  if (snapshot.entitlement.status === 'active') {
    return { id: 'entitlement', status: 'pass', label: 'Access granted' };
  }
  if (snapshot.entitlement.status === 'expired') {
    return {
      id: 'entitlement',
      status: 'fail',
      label: 'Access expired',
      detail: 'Your entitlement has elapsed. Purchase a new pass or redeem a code.',
      remediation: { cta: 'Get access', action: 'purchase_ppv' },
    };
  }
  return {
    id: 'entitlement',
    status: 'fail',
    label: 'No access yet',
    detail: snapshot.game.ppvPriceCad != null
      ? `Buy PPV for $${snapshot.game.ppvPriceCad.toFixed(2)} CAD or redeem a comp code.`
      : 'Purchase a pass or redeem a comp code.',
    remediation: { cta: 'Get access', action: 'purchase_ppv' },
  };
}

export function checkActiveSession(snapshot: PreflightSnapshot): CheckResult {
  if (!snapshot.userId) {
    return { id: 'activeSession', status: 'skipped', label: 'Session check pending sign-in' };
  }
  if (!snapshot.activeSession.hasConflict) {
    return { id: 'activeSession', status: 'pass', label: 'One-device check clear' };
  }
  return {
    id: 'activeSession',
    status: 'fail',
    label: 'Streaming on another device',
    detail: 'You can only watch on one device at a time. Stop the other session first.',
    remediation: { cta: 'Use this device', action: 'displace_session' },
  };
}

export function checkBrowserSupport(caps: BrowserCapabilities): CheckResult {
  const cls = classifyBrowser(caps.userAgent);
  if (cls === 'modern') {
    return { id: 'browserSupport', status: 'pass', label: 'Browser supported' };
  }
  if (cls === 'older') {
    return {
      id: 'browserSupport',
      status: 'warn',
      label: 'Browser is outdated',
      detail: 'For best playback, use the latest Chrome or Safari.',
    };
  }
  return {
    id: 'browserSupport',
    status: 'warn',
    label: 'Browser not recognized',
    detail: 'We could not identify your browser. Playback may be degraded.',
  };
}

export function checkBandwidth(caps: BrowserCapabilities): CheckResult {
  const t = caps.effectiveType;
  if (!t) {
    // Connection API unavailable (Safari, Firefox). Do not penalize —
    // most connections are fine and we do not want to flag the majority
    // of iOS users.
    return { id: 'bandwidth', status: 'pass', label: 'Connection check skipped' };
  }
  if (t === '4g' || t === '5g' || t === 'wifi') {
    return { id: 'bandwidth', status: 'pass', label: 'Connection looks good' };
  }
  if (t === '3g') {
    return {
      id: 'bandwidth',
      status: 'warn',
      label: 'Slow connection',
      detail: 'Stream may buffer. You can still proceed.',
    };
  }
  return {
    id: 'bandwidth',
    status: 'warn',
    label: 'Very slow connection',
    detail: 'Playback will likely buffer. Find Wi-Fi for best results.',
  };
}

export function checkAutoplay(caps: BrowserCapabilities): CheckResult {
  if (caps.canAutoplayMutedVideo) {
    return { id: 'autoplay', status: 'pass', label: 'Autoplay ready' };
  }
  return {
    id: 'autoplay',
    status: 'warn',
    label: 'Tap to start playback',
    detail: 'Your browser requires a tap before video can play. We will prompt you.',
  };
}

/**
 * Replay check — only meaningful when the game is in a post-game state.
 * For live/upcoming games the check is `skipped` (not a failure).
 */
export function checkReplay(snapshot: PreflightSnapshot, now = Date.now()): CheckResult {
  const state = snapshot.game.state;
  if (state !== 'ended_replay' && state !== 'ended_no_replay') {
    return { id: 'replay', status: 'skipped', label: 'Not applicable' };
  }
  if (state === 'ended_no_replay') {
    return {
      id: 'replay',
      status: 'fail',
      label: 'Replay unavailable',
      detail: 'This game is not available for replay.',
    };
  }
  const embargo = snapshot.game.replay.embargoEndsAt;
  if (embargo && new Date(embargo).getTime() > now) {
    return {
      id: 'replay',
      status: 'fail',
      label: 'Replay embargoed',
      detail: `Replay unlocks at ${new Date(embargo).toLocaleString()}.`,
      remediation: {
        cta: 'Notify me',
        action: 'wait_for_replay',
        payload: { embargoEndsAt: embargo },
      },
    };
  }
  if (!snapshot.game.replay.entitled) {
    const price = snapshot.game.replay.priceCad;
    const tier = snapshot.game.replay.qualityTier;
    return {
      id: 'replay',
      status: 'fail',
      label: 'Replay available for purchase',
      detail: price != null
        ? `${tier === 'edited' ? 'Edited' : 'Raw'} replay — $${price.toFixed(2)} CAD.`
        : 'Buy the replay to watch.',
      remediation: { cta: 'Buy replay', action: 'buy_replay' },
    };
  }
  return { id: 'replay', status: 'pass', label: 'Replay access granted' };
}

/** Ordered run of all checks. Pure; use `useEffect` around this. */
export function runAllChecks(
  snapshot: PreflightSnapshot,
  caps: BrowserCapabilities,
  now = Date.now(),
): CheckResult[] {
  return [
    checkAuth(snapshot),
    checkEntitlement(snapshot),
    checkActiveSession(snapshot),
    checkBrowserSupport(caps),
    checkBandwidth(caps),
    checkAutoplay(caps),
    checkReplay(snapshot, now),
  ];
}

/**
 * Aggregate-level verdict used by the orchestrator.
 *   - `blocked` if any check is `fail`
 *   - `warnings` if the worst is `warn`
 *   - `ready` if every relevant check is `pass` or `skipped`
 *   - `pending` if any check is still `pending`
 */
export type PreflightVerdict = 'pending' | 'blocked' | 'warnings' | 'ready';

export function aggregateVerdict(results: CheckResult[]): PreflightVerdict {
  if (results.some((r) => r.status === 'pending')) return 'pending';
  if (results.some((r) => r.status === 'fail')) return 'blocked';
  if (results.some((r) => r.status === 'warn')) return 'warnings';
  return 'ready';
}

export function deriveGameState(args: {
  startsAt: string | null;
  endedAt: string | null;
  isHalftime: boolean;
  replayMode: 'none' | 'raw' | 'edited';
  now?: number;
}): GameStreamState {
  const now = args.now ?? Date.now();
  if (args.endedAt) {
    return args.replayMode === 'none' ? 'ended_no_replay' : 'ended_replay';
  }
  if (args.isHalftime) return 'halftime';
  if (args.startsAt && new Date(args.startsAt).getTime() > now) return 'upcoming';
  if (args.startsAt) return 'live';
  return 'unavailable';
}
