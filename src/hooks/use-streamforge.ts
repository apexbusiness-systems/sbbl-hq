/**
 * useStreamForge — React bridge for the StreamForge broadcast intelligence
 * engine. Wires the pure core to:
 *   - ReactPlayer callbacks (onReady / onBuffer / onBufferEnd / onError / onPlay)
 *   - The NetworkInformation API (`navigator.connection`) when available
 *   - A 15-second telemetry heartbeat
 *   - A beacon shipper that emits on interval and on pagehide
 *   - `<link rel="preconnect">` resource hints for the playback origin
 *
 * The hook is deliberately **observational**: it never mutates the player,
 * never reloads the page, and never throws. All guardrails live in the pure
 * engine; this hook just plumbs events in and out.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyQoeEvent,
  computeHealthScore,
  extractPreconnectOrigin,
  initQoeSnapshot,
  KNOWN_STREAM_ORIGINS,
  normalizeNetworkProfile,
  shouldWarmReconnect,
  withNetwork,
  type HealthScoreBreakdown,
  type NetworkEffectiveType,
  type NetworkProfile,
  type QoeEvent,
  type QoeEventKind,
  type QoeSnapshot,
} from '@/lib/stream/streamforge';
import {
  createBrowserBeaconTransport,
  NOOP_BEACON_TRANSPORT,
  type BeaconTransport,
} from '@/lib/stream/qoe-beacon';

/** Minimal shape of the experimental NetworkInformation API. */
interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (event: 'change', cb: () => void) => void;
  removeEventListener?: (event: 'change', cb: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

function readBrowserNetwork(): NetworkProfile {
  if (typeof navigator === 'undefined') {
    return normalizeNetworkProfile(null);
  }
  const nav = navigator as NavigatorWithConnection;
  const conn: NetworkInformationLike | undefined =
    nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  if (!conn) return normalizeNetworkProfile(null);
  return normalizeNetworkProfile({
    effectiveType:
      (conn.effectiveType as NetworkEffectiveType | undefined) ?? 'unknown',
    downlinkMbps: typeof conn.downlink === 'number' ? conn.downlink : 0,
    rttMs: typeof conn.rtt === 'number' ? conn.rtt : 0,
    saveData: Boolean(conn.saveData),
  });
}

function subscribeToNetwork(cb: (np: NetworkProfile) => void): () => void {
  if (typeof navigator === 'undefined') return () => {};
  const nav = navigator as NavigatorWithConnection;
  const conn: NetworkInformationLike | undefined =
    nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  if (!conn || typeof conn.addEventListener !== 'function') return () => {};
  const handler = (): void => cb(readBrowserNetwork());
  conn.addEventListener('change', handler);
  return () => {
    try {
      conn.removeEventListener?.('change', handler);
    } catch {
      /* ignore */
    }
  };
}

/** Hash a string into a short session id hash. Non-cryptographic — just for grouping. */
function hashSessionId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  // Convert to unsigned hex and pad.
  return `sf-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function injectPreconnect(origin: string): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  try {
    const selector = `link[data-streamforge-preconnect="${origin}"]`;
    const existing = document.head.querySelector<HTMLLinkElement>(selector);
    if (existing) return existing;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    link.setAttribute('data-streamforge-preconnect', origin);
    document.head.appendChild(link);
    return link;
  } catch {
    return null;
  }
}

export interface UseStreamForgeOptions {
  /** Game id used for beacon routing and aggregation. */
  gameId: string | null;
  /** Playback URL currently mounted in the player (for preconnect). */
  playbackUrl: string | null;
  /** Seed used to derive an anonymous session hash (device token etc). */
  sessionSeed: string;
  /** Interval between heartbeat / beacon sends, in ms. Defaults to 15s. */
  beaconIntervalMs?: number;
  /** Override beacon transport — useful for tests. */
  transport?: BeaconTransport;
  /** Disable all beacon traffic (dev mode / tests). */
  disabled?: boolean;
}

export interface UseStreamForgeApi {
  /** Immutable snapshot of current QoE state. */
  snapshot: QoeSnapshot;
  /** Latest derived health score breakdown. */
  health: HealthScoreBreakdown;
  /** Latest network profile. */
  network: NetworkProfile;
  /** Report a player event to the engine. */
  reportEvent: (kind: QoeEventKind, extra?: Partial<QoeEvent>) => void;
  /** Bump the consecutive failure counter; used by the circuit breaker UI. */
  recordFailure: () => void;
  /** Reset the failure counter on successful playback. */
  recordSuccess: () => void;
  /** Check whether a warm reconnect is allowed right now. */
  canWarmReconnect: () => boolean;
  /** Mark that a warm reconnect has just been executed. */
  markWarmReconnect: () => void;
  /** Force a beacon flush immediately (used on pagehide). */
  flushBeacon: () => void;
  /** Consecutive failure count used by the UI circuit-breaker. */
  consecutiveFailures: number;
}

/**
 * React hook wiring StreamForge into the active playback session.
 *
 * Lifecycle:
 *   - On mount: record 'mount' event, inject preconnect links, subscribe to
 *     network changes, and start a 15 s beacon interval.
 *   - On unmount: cleanup interval, remove listeners, and fire one final
 *     beacon via sendBeacon (survives unload).
 */
export function useStreamForge(
  options: UseStreamForgeOptions,
): UseStreamForgeApi {
  const {
    gameId,
    playbackUrl,
    sessionSeed,
    beaconIntervalMs = 15_000,
    transport,
    disabled = false,
  } = options;

  const now = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Date.now()
      : Date.now();

  const sessionHash = useMemo(() => hashSessionId(sessionSeed), [sessionSeed]);

  const [snapshot, setSnapshot] = useState<QoeSnapshot>(() =>
    initQoeSnapshot(sessionHash, now(), readBrowserNetwork()),
  );
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const lastReconnectTsRef = useRef<number | null>(null);
  const snapshotRef = useRef<QoeSnapshot>(snapshot);
  snapshotRef.current = snapshot;

  const chosenTransport = useMemo<BeaconTransport>(() => {
    if (disabled) return NOOP_BEACON_TRANSPORT;
    if (transport) return transport;
    if (typeof window === 'undefined') return NOOP_BEACON_TRANSPORT;
    return createBrowserBeaconTransport();
  }, [transport, disabled]);

  const reportEvent = useCallback<UseStreamForgeApi['reportEvent']>(
    (kind, extra) => {
      setSnapshot((prev) =>
        applyQoeEvent(prev, {
          kind,
          ts: now(),
          ...(extra ?? {}),
        }),
      );
    },
    [],
  );

  const recordFailure = useCallback(() => {
    setConsecutiveFailures((n) => n + 1);
  }, []);

  const recordSuccess = useCallback(() => {
    setConsecutiveFailures(0);
  }, []);

  const canWarmReconnect = useCallback(() => {
    const decision = shouldWarmReconnect({
      consecutiveFailures,
      lastReconnectTs: lastReconnectTsRef.current,
      now: now(),
    });
    return decision.reconnect;
  }, [consecutiveFailures]);

  const markWarmReconnect = useCallback(() => {
    lastReconnectTsRef.current = now();
    setConsecutiveFailures(0);
  }, []);

  // ── Network observer ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToNetwork((np) => {
      setSnapshot((prev) => withNetwork(prev, np));
    });
    // Seed once on mount in case the initial read was stale.
    setSnapshot((prev) => withNetwork(prev, readBrowserNetwork()));
    return unsubscribe;
  }, []);

  // ── Preconnect resource hints ──────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const links: HTMLLinkElement[] = [];

    // Warm well-known origins unconditionally — many streams route through
    // provider infra even before a URL is resolved.
    for (const origin of KNOWN_STREAM_ORIGINS) {
      const link = injectPreconnect(origin);
      if (link) links.push(link);
    }
    // Warm the specific playback origin when known.
    if (playbackUrl) {
      const origin = extractPreconnectOrigin(playbackUrl);
      if (origin) {
        const link = injectPreconnect(origin);
        if (link) links.push(link);
      }
    }

    return () => {
      for (const link of links) {
        try {
          link.parentNode?.removeChild(link);
        } catch {
          /* ignore */
        }
      }
    };
  }, [playbackUrl]);

  // ── Beacon shipper ─────────────────────────────────────────────────────
  const buildBeacon = useCallback(() => {
    const s = snapshotRef.current;
    const health = computeHealthScore(s);
    const startupMs =
      s.firstPlayTs !== null ? Math.max(0, s.firstPlayTs - s.mountTs) : null;
    return {
      gameId: gameId ?? 'broadcast',
      sessionIdHash: s.sessionId,
      score: health.score,
      startupMs,
      rebufferMs: s.rebufferMs,
      playbackMs: s.playbackMs,
      rebufferCount: s.rebufferCount,
      errorCount: s.errorCount,
      network: s.network,
      ts: now(),
    };
  }, [gameId]);

  const flushBeacon = useCallback(() => {
    if (disabled) return;
    if (!gameId) return;
    const beacon = buildBeacon();
    try {
      chosenTransport.send(gameId, beacon);
    } catch {
      /* swallow — beacon delivery is never allowed to break playback */
    }
  }, [disabled, gameId, buildBeacon, chosenTransport]);

  useEffect(() => {
    if (disabled || !gameId) return undefined;
    const interval = Math.max(5_000, beaconIntervalMs);
    // Also mark heartbeat ticks in the snapshot so playbackMs stays current.
    const id = setInterval(() => {
      setSnapshot((prev) =>
        applyQoeEvent(prev, { kind: 'heartbeat', ts: now() }),
      );
      flushBeacon();
    }, interval);
    return () => clearInterval(id);
  }, [disabled, gameId, beaconIntervalMs, flushBeacon]);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return undefined;
    const onHide = (): void => flushBeacon();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [disabled, flushBeacon]);

  const health = useMemo(() => computeHealthScore(snapshot), [snapshot]);

  return {
    snapshot,
    health,
    network: snapshot.network,
    reportEvent,
    recordFailure,
    recordSuccess,
    canWarmReconnect,
    markWarmReconnect,
    flushBeacon,
    consecutiveFailures,
  };
}
