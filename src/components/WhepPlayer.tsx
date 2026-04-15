/**
 * WhepPlayer — WHEP (WebRTC-HTTP Egress Protocol) player
 * Uses @eyevinn/webrtc-player for low-latency live stream playback.
 *
 * REQUIRES: whepUrl pointing to a CORS-enabled WHEP endpoint
 * e.g. https://stream.sbbl-hq.icu/whep/live (MediaMTX behind Caddy)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPlayer } from '@eyevinn/webrtc-player';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';

export type WhepPlayerStatus = 'idle' | 'connecting' | 'live' | 'offline' | 'error';

interface WhepPlayerProps {
  /** Full WHEP endpoint URL */
  whepUrl: string;
  /** Auto-retry interval in ms. 0 = no auto-retry. Default: 10000 */
  retryIntervalMs?: number;
  /** Max retry attempts. 0 = infinite. Default: 5 */
  maxRetries?: number;
  /** Called when status changes */
  onStatusChange?: (status: WhepPlayerStatus) => void;
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

  const scheduleRetry = useCallback(() => {
    if (retryIntervalMs <= 0) return;
    if (maxRetries > 0 && retryCount.current >= maxRetries) {
      updateStatus('offline');
      return;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current); // collapse bursty no-media/error events into a single pending retry
      retryTimer.current = null;
    }
    retryCount.current += 1;
    retryTimer.current = setTimeout(() => {
      reconnectRef.current();
    }, retryIntervalMs);
  }, [maxRetries, retryIntervalMs, updateStatus]);

  const connect = useCallback(async () => {
    if (!videoRef.current || !whepUrl) return;
    destroy();
    updateStatus('connecting');

    try {
      const player = new WebRTCPlayer({
        video: videoRef.current,
        type: 'whep',
        statsTypeFilter: '^candidate-*|^inbound-rtp',
      });
      playerRef.current = player;

      player.on('no-media', () => {
        updateStatus('offline');
        scheduleRetry();
      });

      player.on('media-recovered', () => {
        retryCount.current = 0;
        updateStatus('live');
      });

      await player.load(new URL(whepUrl));
      retryCount.current = 0;
      updateStatus('live');
    } catch (err) {
      console.error('[WhepPlayer] connection failed:', err);
      updateStatus('error');
      scheduleRetry();
    }
  }, [whepUrl, destroy, updateStatus, scheduleRetry]);

  useEffect(() => {
    reconnectRef.current = () => {
      void connect();
    };
  }, [connect]);

  useEffect(() => {
    if (!whepUrl) return destroy;
    void connect(); // fire-and-forget initial dial while lifecycle cleanup is handled by destroy
    return destroy;
  }, [whepUrl, connect, destroy]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted={false}
        playsInline
        className="w-full h-full object-contain"
        aria-label="Live stream video"
      />

      {/* Connecting overlay */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-sm text-zinc-400 font-medium">Connecting to stream…</p>
        </div>
      )}

      {/* Offline / Error overlay */}
      {(status === 'offline' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 gap-4">
          <WifiOff className="w-10 h-10 text-zinc-600" />
          <div className="text-center">
            <p className="text-base font-semibold text-zinc-300">Stream Offline</p>
            <p className="text-xs text-zinc-500 mt-1">
              {status === 'error'
                ? 'Connection failed — the broadcast may not have started yet.'
                : 'Stream ended or broadcaster disconnected.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { retryCount.current = 0; void connect(); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Live badge */}
      {status === 'live' && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded text-white text-[10px] font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Live
        </div>
      )}
    </div>
  );
}
