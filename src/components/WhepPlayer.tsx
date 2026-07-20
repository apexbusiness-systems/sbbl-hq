/**
 * WhepPlayer — WHEP (WebRTC-HTTP Egress Protocol) player
 * Uses @eyevinn/webrtc-player for low-latency live stream playback.
 *
 * REQUIRES: whepUrl pointing to a CORS-enabled WHEP endpoint
 * e.g. https://stream.sbbl-hq.icu/whep/live (MediaMTX behind Caddy)
 *
 * FIX #1: Collapsed dual retry paths into single scheduleRetry() call.
 * FIX #3: Extracted manualRetry callback — eliminates stale closure on retry button.
 * FIX #4: mountedRef guard prevents state updates on unmounted component + explicit
 *         ICE handler cleanup on destroy to stop handler leak after peer connection close.
 * FIX #5: Clear pending retry timer when ICE recovers to 'connected'/'completed' and
 *         when media recovers — prevents zombie retry tearing down healthy stream.
 *         connectingRef blocks overlapping concurrent connect() invocations.
 * ADD:    ICE connection state monitoring ('disconnected'/'failed' triggers scheduleRetry).
 * ADD:    Exponential backoff with jitter — prevents thundering herd on broadcaster restart.
 * ADD:    CORS probe — surfaces actionable error when WHEP origin blocks preflight.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPlayer } from '@eyevinn/webrtc-player';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { probeWhepCors, type WhepProbeResult } from '@/lib/stream/whep-probe';

export type WhepPlayerStatus = 'idle' | 'connecting' | 'live' | 'offline' | 'error';

interface WhepPlayerProps {
  /** Full WHEP endpoint URL */
  whepUrl: string;
  /**
   * Base retry interval in ms. 0 = no auto-retry. Default: 10000.
   * Actual delay uses exponential backoff with jitter:
   *   delay = min(retryIntervalMs * 2^attempt, 60_000) + rand(0..1000)
   */
  retryIntervalMs?: number;
  /** Max retry attempts. 0 = infinite. Default: 5 */
  maxRetries?: number;
  /** Whether the video is muted */
  muted?: boolean;
  /** Volume level 0.0 to 1.0 */
  volume?: number;
  /** Whether the video is playing */
  playing?: boolean;
  /** Called when status changes */
  onStatusChange?: (status: WhepPlayerStatus) => void;
}

/** Compute backoff delay with full-jitter to prevent thundering herd. */
function computeBackoffMs(baseMs: number, attempt: number): number {
  const capped = Math.min(baseMs * Math.pow(2, Math.max(0, attempt - 1)), 60_000);
  return capped + Math.random() * 1_000;
}

export function WhepPlayer({
  whepUrl,
  retryIntervalMs = 10_000,
  maxRetries = 5,
  muted = true,
  volume = 1,
  playing = true,
  onStatusChange,
}: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WebRTCPlayer | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectRef = useRef<() => void>(() => {});
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX #4 — mountedRef prevents setState on unmounted component when
  // player.load() resolves or ICE events fire after unmount.
  const mountedRef = useRef(true);
  // FIX #5 — connectingRef blocks overlapping concurrent connect() calls so
  // bursty retry+ICE+manualRetry events cannot stack up a second player.
  const connectingRef = useRef(false);
  const [status, setStatus] = useState<WhepPlayerStatus>('idle');
  const [corsError, setCorsError] = useState<string | null>(null);

  const updateStatus = useCallback((s: WhepPlayerStatus) => {
    if (!mountedRef.current) return;
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  // FIX #5 — single place to clear a pending retry timer. Used on ICE recovery,
  // media recovery, and explicit manual retry so zombie timers cannot fire
  // after a healthy stream has been restored.
  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const destroy = useCallback(() => {
    clearRetryTimer();
    // FIX #4 — explicitly null the ICE handler so the underlying RTCPeerConnection
    // (which may outlive the destroy call briefly during garbage collection) cannot
    // fire a late state-change event into a stale scheduleRetry closure.
    if (pcRef.current) {
      try { pcRef.current.oniceconnectionstatechange = null; } catch { /* noop */ }
      pcRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // FIX #5 — reset the connecting guard so a subsequent re-mount or whepUrl
    // change can start a fresh connect. Leaving it `true` would starve the
    // next connect() call indefinitely.
    connectingRef.current = false;
  }, [clearRetryTimer]);

  /**
   * FIX #1 — Single retry scheduling path.
   * scheduleRetry is the ONLY place that sets retryTimer.
   * Deduplicates bursty no-media/error/ICE events by clearing any
   * pending timer before scheduling a new one (collapse into one retry).
   * Uses exponential backoff with jitter (ADD: thundering herd prevention).
   */
  const scheduleRetry = useCallback(() => {
    if (!mountedRef.current) return;
    if (retryIntervalMs <= 0) return;
    if (maxRetries > 0 && retryCount.current >= maxRetries) {
      updateStatus('offline');
      return;
    }
    // Collapse any duplicate pending retry — only one timer lives at a time.
    clearRetryTimer();
    retryCount.current += 1;
    const delay = computeBackoffMs(retryIntervalMs, retryCount.current);
    retryTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      reconnectRef.current();
    }, delay);
  }, [maxRetries, retryIntervalMs, updateStatus, clearRetryTimer]);

  const connect = useCallback(async () => {
    if (!videoRef.current || !whepUrl) return;
    // FIX #5 — short-circuit overlapping connect() invocations so a retry
    // timer + ICE event + manualRetry can't stack up a second WebRTCPlayer.
    if (connectingRef.current) return;
    connectingRef.current = true;

    // Clear any pending retry before starting a fresh connection.
    clearRetryTimer();

    if (pcRef.current) {
      try { pcRef.current.oniceconnectionstatechange = null; } catch { /* noop */ }
      pcRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    updateStatus('connecting');
    if (mountedRef.current) setCorsError(null);

    // CORS probe — best-effort pre-flight check. A CORS-blocked WHEP origin
    // otherwise produces a generic "Failed to fetch" that offers no recovery
    // signal to operators. The probe surfaces an actionable hint.
    const probe: WhepProbeResult = await probeWhepCors(whepUrl);
    if (!mountedRef.current) { connectingRef.current = false; return; }
    if (!probe.ok && probe.reason === 'cors_blocked') {
      setCorsError(probe.hint ?? 'CORS preflight failed for WHEP origin.');
      updateStatus('error');
      connectingRef.current = false;
      scheduleRetry();
      return;
    }

    try {
      const player = new WebRTCPlayer({
        video: videoRef.current,
        type: 'whep',
        statsTypeFilter: '^candidate-*|^inbound-rtp',
      });
      playerRef.current = player;

      // FIX #1 — no-media uses ONLY scheduleRetry(). No inline setTimeout.
      player.on('no-media', () => {
        if (!mountedRef.current) return;
        updateStatus('offline');
        scheduleRetry();
      });

      player.on('media-recovered', () => {
        if (!mountedRef.current) return;
        retryCount.current = 0;
        // FIX #5 — clear the pending retry timer so a scheduled reconnect
        // cannot tear down the just-recovered stream 10s later.
        clearRetryTimer();
        updateStatus('live');
      });

      // Hook into the underlying peer connection for ICE state changes.
      // @eyevinn/webrtc-player exposes the pc via player.load resolving;
      // we intercept via the video element's srcObject after load.
      const originalLoad = player.load.bind(player);
      player.load = async (url: URL) => {
        await originalLoad(url);
        // After load, grab the RTCPeerConnection from the player internals.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pc: RTCPeerConnection | undefined = (player as any)._pc ?? (player as any).pc;
        if (pc) {
          // FIX #4 — stash the pc so destroy() can null the handler explicitly,
          // preventing late state-change events from firing into stale closures.
          pcRef.current = pc;
          pc.oniceconnectionstatechange = () => {
            if (!mountedRef.current) return;
            const state = pc.iceConnectionState;
            if (state === 'disconnected' || state === 'failed') {
              updateStatus('offline');
              scheduleRetry(); // ADD: ICE failure triggers single retry path
            } else if (state === 'connected' || state === 'completed') {
              retryCount.current = 0;
              // FIX #5 — ICE recovery must also cancel any pending retry timer
              // scheduled by a prior 'disconnected' event; otherwise a zombie
              // timer reconnects a healthy stream and breaks playback.
              clearRetryTimer();
              updateStatus('live');
            }
          };
        }
      };

      await player.load(new URL(whepUrl));
      if (!mountedRef.current) return;
      retryCount.current = 0;
      clearRetryTimer();
      updateStatus('live');
    } catch (err) {
      console.error('[WhepPlayer] connection failed:', err);
      if (!mountedRef.current) return;
      // Enrich the error surface if the failure signature matches a CORS block.
      if (err instanceof TypeError && /fetch|network|cors/i.test(err.message)) {
        setCorsError(
          'WHEP origin may not be CORS-enabled. Verify Access-Control-Allow-Origin on your MediaMTX/Caddy config.',
        );
      }
      updateStatus('error');
      // FIX #1 — catch block uses ONLY scheduleRetry(). No inline setTimeout.
      scheduleRetry();
    } finally {
      connectingRef.current = false;
    }
    // connect references itself via reconnectRef; deps are external inputs only.
  }, [whepUrl, updateStatus, scheduleRetry, clearRetryTimer]);

  useEffect(() => {
    reconnectRef.current = () => { void connect(); };
  }, [connect]);

  // FIX #4 — mountedRef lifecycle. Set true on mount, false on unmount so
  // any late-resolving player.load() or ICE event cannot setState on a dead
  // component.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!whepUrl) return destroy;
    void connect();
    return destroy;
  }, [whepUrl, connect, destroy]);

  // Apply volume changes imperatively since React video[volume] attribute is unreliable
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Apply play/pause changes imperatively
  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        const playPromise = videoRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Ignore play errors (e.g. autoplay blocked)
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing]);

  /**
   * FIX #3 — manualRetry callback.
   * Extracted from inline JSX onClick to eliminate stale closure over connect.
   * Resets retryCount and clears any pending timer before re-invoking connect
   * so maxRetries gate is re-evaluated with a clean counter.
   */
  const manualRetry = useCallback(() => {
    retryCount.current = 0;
    clearRetryTimer();
    setCorsError(null);
    void connect();
  }, [connect, clearRetryTimer]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-contain"
      />

      {/* Connecting overlay */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
          <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
          <span className="text-[#F5F5F0] text-sm font-medium">Connecting to stream&hellip;</span>
        </div>
      )}

      {/* Offline/error overlay — FIX #3: onClick uses manualRetry() */}
      {(status === 'offline' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4 px-6">
          <WifiOff className="w-10 h-10 text-[#8A8A8A]" />
          <div className="text-center max-w-md">
            <p className="text-[#F5F5F0] font-semibold text-base">
              {status === 'offline' ? 'Stream offline' : 'Playback error'}
            </p>
            <p className="text-[#8A8A8A] text-sm mt-1">
              {retryIntervalMs > 0
                ? 'Retrying automatically with backoff…'
                : 'Check stream source and retry manually.'}
            </p>
            {/* CORS probe hint — only rendered when the probe surfaced one */}
            {corsError && (
              <p
                data-testid="whep-cors-hint"
                className="mt-3 text-[11px] leading-relaxed text-amber-400/90 border border-amber-500/30 bg-amber-500/5 rounded px-3 py-2"
              >
                {corsError}
              </p>
            )}
          </div>
          <button
            onClick={manualRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#C9A84C] hover:bg-[#E8C76A] text-black text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry now
          </button>
        </div>
      )}

      {/* Live badge */}
      {status === 'live' && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      )}
    </div>
  );
}
