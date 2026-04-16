/**
 * WhepPlayer — WHEP (WebRTC-HTTP Egress Protocol) player
 * Uses @eyevinn/webrtc-player for low-latency live stream playback.
 *
 * REQUIRES: whepUrl pointing to a CORS-enabled WHEP endpoint
 * e.g. https://stream.sbbl-hq.icu/whep/live (MediaMTX behind Caddy)
 *
 * FIX #1: Collapsed dual retry paths into single scheduleRetry() call.
 * FIX #3: Extracted manualRetry callback — eliminates stale closure on retry button.
 * ADD: ICE connection state monitoring ('disconnected'/'failed' triggers scheduleRetry).
 * ADD: Exponential backoff with jitter — prevents thundering herd on broadcaster restart.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPlayer } from '@eyevinn/webrtc-player';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';

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
  onStatusChange,
}: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WebRTCPlayer | null>(null);
  const reconnectRef = useRef<() => void>(() => {});
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<WhepPlayerStatus>('idle');

  const updateStatus = useCallback((s: WhepPlayerStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const destroy = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * FIX #1 — Single retry scheduling path.
   * scheduleRetry is the ONLY place that sets retryTimer.
   * Deduplicates bursty no-media/error/ICE events by clearing any
   * pending timer before scheduling a new one (collapse into one retry).
   * Uses exponential backoff with jitter (ADD: thundering herd prevention).
   */
  const scheduleRetry = useCallback(() => {
    if (retryIntervalMs <= 0) return;
    if (maxRetries > 0 && retryCount.current >= maxRetries) {
      updateStatus('offline');
      return;
    }
    // Collapse any duplicate pending retry — only one timer lives at a time.
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    retryCount.current += 1;
    const delay = computeBackoffMs(retryIntervalMs, retryCount.current);
    retryTimer.current = setTimeout(() => {
      reconnectRef.current();
    }, delay);
  }, [maxRetries, retryIntervalMs, updateStatus]);

  const connect = useCallback(async () => {
    if (!videoRef.current || !whepUrl) return;

    // Clear any pending retry before starting a fresh connection.
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    updateStatus('connecting');

    try {
      const player = new WebRTCPlayer({
        video: videoRef.current,
        type: 'whep',
        statsTypeFilter: '^candidate-*|^inbound-rtp',
      });
      playerRef.current = player;

      // FIX #1 — no-media uses ONLY scheduleRetry(). No inline setTimeout.
      player.on('no-media', () => {
        updateStatus('offline');
        scheduleRetry();
      });

      player.on('media-recovered', () => {
        retryCount.current = 0;
        updateStatus('live');
      });

      // ADD: ICE connection state monitoring.
      // The underlying RTCPeerConnection ICE failures cause frozen black screens
      // with the 'live' badge still showing if not handled explicitly.
      player.on('no-media', () => { /* already handled above */ });

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
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'disconnected' || state === 'failed') {
              updateStatus('offline');
              scheduleRetry(); // ADD: ICE failure triggers single retry path
            } else if (state === 'connected' || state === 'completed') {
              retryCount.current = 0;
              updateStatus('live');
            }
          };
        }
      };

      await player.load(new URL(whepUrl));
      retryCount.current = 0;
      updateStatus('live');
    } catch (err) {
      console.error('[WhepPlayer] connection failed:', err);
      updateStatus('error');
      // FIX #1 — catch block uses ONLY scheduleRetry(). No inline setTimeout.
      scheduleRetry();
    }
    // connect references itself via reconnectRef; deps are external inputs only.
  }, [whepUrl, updateStatus, scheduleRetry]);

  useEffect(() => {
    reconnectRef.current = () => { void connect(); };
  }, [connect]);

  useEffect(() => {
    if (!whepUrl) return destroy;
    void connect();
    return destroy;
  }, [whepUrl, connect, destroy]);

  /**
   * FIX #3 — manualRetry callback.
   * Extracted from inline JSX onClick to eliminate stale closure over connect.
   * Resets retryCount and clears any pending timer before re-invoking connect
   * so maxRetries gate is re-evaluated with a clean counter.
   */
  const manualRetry = useCallback(() => {
    retryCount.current = 0;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    void connect();
  }, [connect]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4">
          <WifiOff className="w-10 h-10 text-[#8A8A8A]" />
          <div className="text-center">
            <p className="text-[#F5F5F0] font-semibold text-base">
              {status === 'offline' ? 'Stream offline' : 'Playback error'}
            </p>
            <p className="text-[#8A8A8A] text-sm mt-1">
              {retryIntervalMs > 0
                ? 'Retrying automatically with backoff…'
                : 'Check stream source and retry manually.'}
            </p>
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
