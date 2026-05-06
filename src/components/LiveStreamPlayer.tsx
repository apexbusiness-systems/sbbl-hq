/**
 * LiveStreamPlayer.tsx
 * Renders the live-stream broadcast area with a multi-layer access gate:
 *
 *   Unregistered (no auth.user)           → registration wall → /register?redirect=/live
 *   player role                           → free access always → branded app player
 *   paid_fan | super_admin                → free access + invite generator → player
 *   fan with PPV entitlement (Stripe)     → access → player
 *   fan with redeemed invite              → access → player
 *   fan with no access                    → preview gate → PPV buy ($4.99) + invite redeem
 *
 * IP locking and single-use enforcement happen server-side in /api/invite/redeem.
 * No role/entitlement data is trusted from the client.
 *
 * Uses ReactPlayer for live stream playback (YouTube, HLS, etc.).
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Play, Pause, Ticket, Copy, Check, KeyRound, Volume2, VolumeX, Maximize, AlertTriangle } from 'lucide-react';
import ReactPlayer from 'react-player/lazy';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { redeemAccessCode } from '@/lib/api/stream';
import { IDEMPOTENCY_HEADER, createIdempotencyKey } from '@/lib/api/idempotency';
import { isYoutubeUrl } from '@/lib/stream/youtube-url';
import { detectStreamUrlType, toPlayableUrl } from '@/lib/stream/url-detector';
import type { StreamUrlType } from '@/lib/stream/url-detector';
import { WhepPlayer } from '@/components/WhepPlayer';
import { useTurnstile } from '@/hooks/use-turnstile';
import { useStreamForge } from '@/hooks/use-streamforge';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import gameAction from '@/assets/game-action.svg';
import type { Game } from '@/types';
import type { AppRole } from '@/lib/auth/roles';

/**
 * AccessCodeRedeem
 * Standalone token input for any viewer. Accepts a comp code or invite UUID,
 * derives the gameId server-side, and calls window.location.reload() on
 * success so the player re-fetches entitlement and starts playback.
 *
 * Rendered in multiple gates (unregistered prompt, loading state, preview
 * paywall) so anyone who has a token can redeem it regardless of the player's
 * current state — no forced navigation required.
 */
function AccessCodeRedeem({
  variant = 'dark',
  onRedeemed,
}: Readonly<{
  variant?: 'dark' | 'light';
  onRedeemed?: () => void;
}>) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { containerRef: turnstileRef, resolveToken } = useTurnstile();

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await redeemAccessCode(
        trimmed,
        null,
        { captchaToken: await resolveToken() },
      );
      toast.success('Access granted — loading stream…');
      if (onRedeemed) {
        onRedeemed();
      } else {
        setTimeout(() => window.location.reload(), 400);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'ip_mismatch' || msg === 'non_transferable') {
        toast.error('This code cannot be used from your device or location.');
      } else if (msg === 'expired') {
        toast.error('This access code has expired.');
      } else if (msg === 'invalid_invite') {
        toast.error('Access code not found. Check for typos.');
      } else if (msg === 'cannot_redeem_own_invite') {
        toast.error('You cannot redeem a code you generated.');
      } else if (msg === 'rate_limited') {
        toast.error('Too many attempts. Please wait a minute.');
      } else {
        toast.error('Could not redeem access code. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <div ref={turnstileRef} className="sr-only" aria-hidden="true" />
      <p className={`text-xs ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
        Have an access code?
      </p>
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleRedeem(); }}
          placeholder="Paste your code…"
          maxLength={64}
          disabled={submitting}
          className={`flex-1 px-3 py-2 text-xs rounded-sm border focus:outline-none font-mono ${
            isDark
              ? 'bg-white/10 border-white/15 text-white placeholder-white/40 focus:border-amber-500/60'
              : 'bg-secondary border-border text-foreground placeholder-muted-foreground focus:border-amber-500/50'
          } disabled:opacity-50`}
          aria-label="Access code"
        />
        <button
          type="button"
          disabled={!code.trim() || submitting}
          onClick={() => void handleRedeem()}
          className="px-3 py-2 text-xs bg-amber-500 text-black rounded-sm font-bold uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0"
        >
          <KeyRound className="w-3.5 h-3.5" />
          {submitting ? '…' : 'Redeem'}
        </button>
      </div>
      <p className={`text-[10px] leading-relaxed text-center ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>
        Codes are IP-locked, single-use, and expire after first view.
      </p>
    </div>
  );
}

/** Maps YouTube IFrame API numeric error codes to human-readable messages. */
const YOUTUBE_ERROR_MESSAGES: Partial<Record<number, string>> = {
  2:   'Invalid stream URL — check the link in broadcast controls.',
  5:   'This video cannot play in an embedded player.',
  100: 'Video not found or set to private.',
  101: 'Stream owner has disabled embedding. Try a different source URL.',
  150: 'Stream owner has disabled embedding. Try a different source URL.',
};

function parsePlayerError(
  err: unknown,
  data: { error?: number } | null | undefined,
): string {
  if (data != null && typeof data.error === 'number') {
    return (
      YOUTUBE_ERROR_MESSAGES[data.error] ??
      `Stream error (YouTube code ${data.error}). Try a different URL.`
    );
  }
  if (err instanceof Event) {
    const video = (err as Event & { target?: HTMLVideoElement }).target;
    const code = video?.error?.code;
    if (code === 2) return 'Network error while loading stream. Check your connection.';
    if (code === 3) return 'Stream format is not supported by this browser.';
    if (code === 4) return 'Stream source is unavailable or the URL is invalid.';
  }
  if (err instanceof Error) return `Stream error: ${err.message}`;
  return 'Stream connection failed — check the URL in broadcast controls or try again.';
}

function StreamPlayer({
  url,
  isSuperAdmin: _isSuperAdmin,
  providerHint,
  onReady,
  onPlay,
  onError,
}: Readonly<{
  url: string;
  isSuperAdmin: boolean;
  providerHint?: StreamUrlType | null;
  onReady: () => void;
  onPlay: () => void;
  onError: (message: string) => void;
}>) {
  const urlType = detectStreamUrlType(url);
  const isYoutube = urlType === 'youtube' || isYoutubeUrl(url);
  // Playback URLs may be signed/proxied and hide provider hostnames; use the
  // upstream source hint from session/game config to preserve provider logic.
  const isTwitch = urlType === 'twitch' || providerHint === 'twitch';
  const isVimeo = urlType === 'vimeo';
  const isWhep = urlType === 'whep';
  const isRtmp = urlType === 'rtmp';
  // Facebook: short-circuit before ReactPlayer so the FB SDK never loads.
  // Rendered via plugins/video.php iframe — no connect.facebook.net request.
  // Kick/Instagram/X-Spaces: no public embed surface; still show advisory.
  const isFacebook = urlType === 'facebook';
  const isUnembeddable =
    urlType === 'kick' || urlType === 'instagram' || urlType === 'x-spaces';
  // HLS and DASH use ReactPlayer with explicit forcing flags
  const forceHls = urlType === 'hls';
  const forceDash = urlType === 'dash';

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Twitch autoplay is fragile under provider visibility checks; start paused
  // and require a user gesture for deterministic playback.
  const [playing, setPlaying] = useState(!isTwitch);
  const [hasUserStarted, setHasUserStarted] = useState(!isTwitch);
  // Start muted so cross-origin autoplay is permitted by Chrome. Unmuted
  // autoplay is blocked for cross-origin iframes regardless of
  // Permissions-Policy — the browser requires a user gesture.
  const [muted, setMuted] = useState(true);
  // True once the stream fires its first onPlay event. Used to gate the
  // tap-to-unmute overlay so it never appears before playback has started.
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  // Twitch's embed SDK measures iframe dimensions/visibility at creation time.
  // If it initializes while the aspect-ratio box is still resolving, Twitch
  // latches a 0×0 or off-viewport state and disables autoplay permanently.
  // Gate mount until the host is both sized and in viewport.
  const [containerReady, setContainerReady] = useState(false);
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let raf = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let activated = false;

    const promoteWhenVisible = () => {
      if (activated) return;
      const rect = host.getBoundingClientRect();
      // Require practical embed dimensions + viewport intersection before mount.
      const hasPlayableSize = rect.width >= 200 && rect.height >= 120;
      const inViewport =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;
      if (hasPlayableSize && inViewport) {
        activated = true;
        setContainerReady(true);
      }
    };

    const schedulePromote = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(promoteWhenVisible);
    };

    schedulePromote();
    const resizeObserver = new ResizeObserver(schedulePromote);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(schedulePromote, { threshold: [0, 0.01] });
    intersectionObserver.observe(host);
    window.addEventListener('resize', schedulePromote);
    window.addEventListener('scroll', schedulePromote, { passive: true });

    // Safety net: never leave the player unmounted indefinitely.
    timeoutId = setTimeout(() => {
      if (!activated) {
        activated = true;
        setContainerReady(true);
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', schedulePromote);
      window.removeEventListener('scroll', schedulePromote);
    };
  }, []);
  const [volume, setVolume] = useState(0.8);
  const [playedFraction, setPlayedFraction] = useState(0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  // Auto-retry: allow one silent retry on transient errors before showing error UI
  const retryCountRef = useRef(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const MAX_AUTO_RETRIES = 1;

  useEffect(() => {
    return () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, []);

  // Force unified in-app controls for all providers.
  const showNativeControls = false;
  const canSeek = Number.isFinite(durationSeconds) && durationSeconds > 0 && !isWhep && !isRtmp;

  const formatClock = (total: number) => {
    const safe = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return h > 0
      ? `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleFullscreen = async () => {
    const host = containerRef.current;
    if (!host) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await host.requestFullscreen();
      }
    } catch (err) {
      onError(`Fullscreen unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // RTMP URLs cannot play in the browser — show advisory overlay
  if (isRtmp) {
    return (
      <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-3 px-6 text-center" data-testid="stream-player">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-sm font-semibold text-white">RTMP Stream Detected</p>
        <p className="text-xs text-white/60 max-w-xs leading-relaxed">
          RTMP cannot play directly in the browser. Configure an HLS endpoint
          (e.g. <code className="text-amber-400">https://…/live/stream.m3u8</code>) in Broadcast Controls.
        </p>
      </div>
    );
  }

  // Facebook: use the official plugins/video.php sandboxed iframe — no FB SDK
  // ever loads (connect.facebook.net remains blocked in script-src). ReactPlayer
  // never mounts for this branch; the frame-src CSP allows facebook.com only.
  if (isFacebook) {
    return (
      <div className="absolute inset-0 bg-black" data-testid="stream-player">
        <iframe
          src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&allowfullscreen=true&autoplay=true`}
          className="w-full h-full"
          style={{ border: 'none', overflow: 'hidden' }}
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          title="Facebook Live Stream"
        />
      </div>
    );
  }

  // Other walled-garden providers (Kick, Instagram Live, X Spaces) advertise
  // no public embed surface compatible with our CSP; treat them like Facebook.
  if (isUnembeddable) {
    const label =
      urlType === 'kick' ? 'Kick'
      : urlType === 'instagram' ? 'Instagram Live'
      : 'X Spaces';
    return (
      <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-3 px-6 text-center" data-testid="stream-player">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-sm font-semibold text-white">{label} Not Supported</p>
        <p className="text-xs text-white/60 max-w-xs leading-relaxed">
          {label} does not provide an embeddable player URL. Configure an HLS
          endpoint, or a YouTube / Twitch / Vimeo URL, in Broadcast Controls.
        </p>
      </div>
    );
  }

  // WHEP — WebRTC low-latency player
  if (isWhep) {
    return (
      <div ref={containerRef} className="absolute inset-0 bg-black" data-testid="stream-player">
        <WhepPlayer
          whepUrl={url}
          retryIntervalMs={10_000}
          maxRetries={5}
          onStatusChange={(status) => {
            if (status === 'live') { onReady(); onPlay(); }
            if (status === 'error') onError('WebRTC connection failed — the stream may not have started yet.');
          }}
        />
      </div>
    );
  }

  // HLS / DASH / YouTube / Twitch / Vimeo / direct / unknown — use ReactPlayer
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'sbbl-hq.icu';
  // Twitch rejects embeds whose `parent` list does not include the actual
  // document origin. A single entry fails on www/apex/localhost. Union the
  // known SBBL surface areas with the current host so every environment
  // (production, preview domains, local dev) loads without manual rewiring.
  const twitchParents = Array.from(new Set([
    currentHost,
    'sbbl-hq.icu',
    'www.sbbl-hq.icu',
    'localhost',
  ].filter(Boolean)));

  // A URL is "proxy-authenticated" when it's served from our own sbbl-hq.icu
  // infrastructure behind the sbbl_proxy_auth cookie. External CDN videos
  // (league highlights, direct MP4s on a public bucket) respond with
  // `Access-Control-Allow-Origin: *` which is incompatible with credentialed
  // requests — browsers will reject playback with a CORS error. Detect and
  // downgrade to anonymous CORS so every public video URL plays seamlessly.
  const isProxyAuthedUrl = /\.sbbl-hq\.icu(?:\/|$)/i.test(url) || url.startsWith('/');
  const isLocalBlob = urlType === 'local' || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('file:');
  const reactPlayerConfig = {
    youtube: {
      playerVars: {
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        // FIX: origin must match the host to prevent YouTube iframe API
        // postMessage cross-origin errors that crash the embed entirely.
        // Without this, the YT iframe tries to postMessage to youtube.com
        // instead of sbbl-hq.icu, which the browser blocks.
        origin: typeof window !== 'undefined' ? window.location.origin : 'https://sbbl-hq.icu',
      },
    },
    twitch: {
      options: {
        // REQUIRED: Twitch embeds will not load without every allowed parent.
        // https://dev.twitch.tv/docs/embed/everything/#required-parameters
        parent: twitchParents,
        // Explicitly disable provider-level autoplay; playback starts from an
        // explicit user gesture to avoid Twitch visibility-gated failures.
        autoplay: false,
        // Keep muted true in embed options so Twitch starts cleanly once the
        // viewer clicks Start Stream and playback begins.
        muted: true,
        playsinline: true,
      },
    },
    file: {
      ...(forceHls ? { forceHLS: true } : {}),
      ...(forceDash ? { forceDASH: true } : {}),
      hlsOptions: {
        // withCredentials only for proxy-authed URLs — external CDNs respond
        // with ACAO: * which browsers reject under credentialed mode.
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = isProxyAuthedUrl;
        },
      },
      // blob: URLs: omit crossOrigin entirely (no cross-origin request at all).
      // Proxy-authed URLs: use-credentials so sbbl_proxy_auth cookie attaches.
      // Everything else (public CDNs, Twitch VODs, league highlight links):
      // anonymous so the browser does not demand credentialed CORS headers.
      ...(isLocalBlob
        ? {}
        : { attributes: { crossOrigin: isProxyAuthedUrl ? 'use-credentials' : 'anonymous' } }),
    },
  };
  // Mount the player only after the host element has practical dimensions
  // and is in the viewport. Twitch's embed SDK runs its visibility checks
  // synchronously at init: if the iframe is 0×0 or off-viewport when the
  // SDK initializes, it latches autoplay-disabled with errors like
  // "minimum requirements for autoplay were not met: style visibility, size,
  // viewport visibility" and never recovers without a remount.
  const shouldRenderPlayer = containerReady;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black"
      style={{ width: '100%', height: '100%', minWidth: 400, minHeight: 300 }}
      data-testid="stream-player"
      data-container-ready={containerReady ? 'true' : 'false'}
    >
      {shouldRenderPlayer && (
        <ReactPlayer
          ref={(instance) => { reactPlayerRef.current = instance; }}
          url={url}
          width="100%"
          height="100%"
          playing={hasUserStarted ? playing : false}
          controls={showNativeControls}
          muted={muted}
          volume={volume}
          onReady={() => { retryCountRef.current = 0; onReady(); }}
          onDuration={(seconds) => setDurationSeconds(seconds)}
          onProgress={({ played, playedSeconds: elapsed }) => {
            setPlayedFraction(played);
            setPlayedSeconds(elapsed);
          }}
          onPlay={() => { setPlaying(true); retryCountRef.current = 0; setHasStartedPlaying(true); onPlay(); }}
          onPause={() => setPlaying(false)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError={(err: any, data: any) => {
            // Auto-retry: on first transient error, retry silently after 3s
            // to avoid killing the player for 20k viewers on a single hiccup.
            if (retryCountRef.current < MAX_AUTO_RETRIES) {
              retryCountRef.current += 1;
              setPlaying(false);
              if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
              autoRetryTimerRef.current = setTimeout(() => {
                autoRetryTimerRef.current = null;
                setPlaying(true);
              }, 3_000);
              return;
            }
            onError(parsePlayerError(err, data));
          }}
          config={reactPlayerConfig}
        />
      )}
      {/* Tap-to-unmute overlay — only shown after the stream fires its first
          onPlay event, so it never appears during the connecting spinner. */}
      {shouldRenderPlayer && muted && hasStartedPlaying && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-lg hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          aria-label="Tap to unmute audio"
          data-testid="tap-to-unmute"
        >
          <VolumeX className="w-4 h-4" />
          Tap to unmute
        </button>
      )}
      {isTwitch && !hasUserStarted && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35">
          <button
            type="button"
            onClick={() => {
              setMuted(true);
              setHasUserStarted(true);
              setPlaying(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-black shadow-lg hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label="Start Twitch playback"
          >
            <Play className="h-4 w-4" />
            Start Stream
          </button>
        </div>
      )}
      {/* Block iframe click-through for YouTube/Vimeo only.
          Twitch's embed SDK validates iframe visibility at init — an opaque
          overlay on top of the Twitch iframe causes the SDK to fail its
          viewport-visibility check and permanently disable autoplay.
          Twitch retains its own native controls and context menu. */}
      {(isYoutube || isVimeo) && (
        <div
          className="absolute inset-0 z-10"
          aria-hidden="true"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      <div
        className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-md bg-black/60 border border-white/10 p-2 backdrop-blur-sm"
        onContextMenu={(e) => e.preventDefault()}
      >
          <button type="button" className="p-2 rounded hover:bg-white/10 text-white transition-colors"
            aria-label={playing ? 'Pause playback' : 'Play playback'} onClick={() => setPlaying(v => !v)}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button type="button" className="p-2 rounded hover:bg-white/10 text-white transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(v => !v)}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => { const n = Number(e.target.value); setMuted(n === 0); setVolume(n); }}
            className="w-24 accent-amber-500" />
          <input
            aria-label="Seek"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={playedFraction}
            disabled={!canSeek}
            onChange={(e) => {
              const nextFraction = Number(e.target.value);
              setPlayedFraction(nextFraction);
              const player = reactPlayerRef.current;
              if (player && canSeek) player.seekTo(nextFraction, 'fraction');
            }}
            className="flex-1 accent-amber-500 disabled:opacity-40"
          />
          <span className="text-[10px] text-white/70 tabular-nums min-w-[82px] text-right">
            {formatClock(playedSeconds)} / {formatClock(durationSeconds)}
          </span>
          <button type="button" className="p-2 rounded hover:bg-white/10 text-white transition-colors"
            aria-label="Toggle fullscreen" onClick={() => void handleFullscreen()}>
            <Maximize className="w-4 h-4" />
          </button>
      </div>
    </div>
  );
}

const PPV_PRICE_CAD = 4.99;
const ALBERTA_GST = 0.05;
/** Tax-inclusive price shown to Alberta viewers */
const PPV_PRICE_TOTAL = Math.round(PPV_PRICE_CAD * (1 + ALBERTA_GST) * 100) / 100;



const DEVICE_TOKEN_KEY = 'sbbl:stream-device-token:v1';

function getOrCreateDeviceToken(): string {
  const existing = globalThis.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing && existing.length >= 16) return existing;
  const generated = crypto.randomUUID();
  globalThis.localStorage.setItem(DEVICE_TOKEN_KEY, generated);
  return generated;
}

interface LiveStreamPlayerProps {
  game: Game;
  userId: string | null;
  roles: AppRole[];
  hasPremiumPlayerAccess: boolean;
  /** Whether admin has set stream to live */
  isStreamLive?: boolean;
  /** Server oracle already confirmed this viewer may watch this broadcast. */
  serverGrantedAccess?: boolean;
}

export function LiveStreamPlayer({
  game,
  userId,
  roles,
  hasPremiumPlayerAccess,
  isStreamLive,
}: Readonly<LiveStreamPlayerProps>) {
  const [ppvEntitled, setPpvEntitled] = useState(false);
  const [inviteGranted, setInviteGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [purchasing, setPurchasing] = useState(false);

  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);


  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackTypeHint, setPlaybackTypeHint] = useState<StreamUrlType | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [heartbeatFailures, setHeartbeatFailures] = useState(0);
  const { containerRef: turnstileRef, resolveToken } = useTurnstile();

  // ── StreamForge QoE telemetry (observational — never mutates player) ──────
  const sessionSeed = useMemo(
    () => (userId ? `${userId}-${getOrCreateDeviceToken()}` : getOrCreateDeviceToken()),
    [userId],
  );
  const sf = useStreamForge({
    gameId: userId ? game.id : null,
    playbackUrl: playbackUrl || null,
    sessionSeed,
  });

  // ── Role classification ──────────────────────────────────────────────────
  const isPlayer    = roles.includes('player');
  const isPaidFan   = roles.includes('paid_fan');
  const isSuperAdmin = roles.includes('super_admin');

  const hasRoleAccess = isPlayer || isPaidFan || isSuperAdmin;
  const canGenerateInvite = hasPremiumPlayerAccess || isPaidFan || isSuperAdmin;
  const hasAccess = hasRoleAccess || serverGrantedAccess || ppvEntitled || inviteGranted;

  // ── Fetch stream entitlement (skip if role already grants access) ─────────
  // Pass null instead of explicit token — apiFetch auto-fetches a fresh JWT
  // via getAuthToken(), preventing stale-token 401 loops.
  useEffect(() => {
    if (!userId || hasRoleAccess || serverGrantedAccess) {
      setAccessChecked(true);
      return;
    }

    const accessEndpoint = game.id === 'broadcast'
      ? '/api/broadcast/access'
      : `/api/streams/${game.id}/access`;
    apiFetch<{ hasAccess: boolean }>(accessEndpoint, {}, null)
      .then(res => {
        if (res.hasAccess) setPpvEntitled(true);
      })
      .catch(() => { /* network error — stay in preview; user can retry purchase */ })
      .finally(() => setAccessChecked(true));
  }, [userId, game.id, hasRoleAccess, serverGrantedAccess]);

  // Retry key: incrementing this re-triggers the session effect after the
  // user clicks "Retry" on the player error screen, without requiring a full
  // page reload.  Previously clicking Retry only cleared the error state but
  // never re-ran the effect, so the player stayed blank forever.
  const [retryKey, setRetryKey] = useState(0);

  // Start playback session — all API calls use null token so apiFetch
  // auto-refreshes the JWT, preventing stale-token 401 loops.
  // Circuit breaker: after 3 consecutive heartbeat failures, notify the
  // viewer and stop the heartbeat interval to prevent battery drain.
  const MAX_HEARTBEAT_FAILURES = 3;

  useEffect(() => {
    if (!hasAccess || !userId) return;
    let active = true;
    let heartbeatId: ReturnType<typeof globalThis.setInterval> | null = null;
    let sessionIdForCleanup: string | null = null;
    let consecutiveFailures = 0;
    setPlaybackLoading(true);
    setPlayerError(null);
    setPlaybackTypeHint(null);
    setHeartbeatFailures(0);
    const deviceToken = getOrCreateDeviceToken();
    const sessionKey = `playback-${game.id}-${deviceToken}`;
    const start = async () => {
      try {
        const res = await apiFetch<{
          playback: { url: string; heartbeatIntervalSec: number; maxExpiresAt?: string };
          session: { id: string; maxExpiresAt?: string };
        }>(game.id === 'broadcast' ? '/api/broadcast/session' : `/api/streams/${game.id}/session`, {
          method: 'POST',
          headers: { [IDEMPOTENCY_HEADER]: createIdempotencyKey('stream-session') },
          body: JSON.stringify({ sessionKey }),
        }, null);
        if (!active) return;
        const rawResolved =
          res.playback.url ||
          (import.meta.env.VITE_STREAM_URL as string | undefined) ||
          '';
        // RC-3: Surface a named error if no URL is available after all fallbacks
        if (!rawResolved.trim()) {
          setPlayerError(
            isSuperAdmin
              ? 'No stream URL configured — add one in Broadcast Controls'
              : 'Stream starting soon',
          );
          return;
        }
        const rawType = detectStreamUrlType(rawResolved);
        const { url: resolvedUrl, type: normalizedType } = toPlayableUrl(rawResolved);
        setPlaybackTypeHint(normalizedType === 'unknown' ? rawType : normalizedType);
        setPlaybackUrl(resolvedUrl);
        sessionIdForCleanup = res.session.id;
        const hbMs = Math.max(10000, res.playback.heartbeatIntervalSec * 1000);

        // 6-hour hard cap: schedule auto-termination at maxExpiresAt
        if (res.session.maxExpiresAt) {
          const msUntilCap = new Date(res.session.maxExpiresAt).getTime() - Date.now();
          if (msUntilCap > 0) {
            hardCapTimerId = globalThis.setTimeout(() => {
              hardCapTimerId = null;
              if (!active) return;
              if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
              toast.error('Your 6-hour viewing session has ended. Purchase a new pass to continue.');
            }, msUntilCap);
          }
        }
        heartbeatId = globalThis.setInterval(() => {
          void apiFetch(game.id === 'broadcast' ? '/api/broadcast/session/heartbeat' : `/api/streams/${game.id}/session/heartbeat`, {
            method: 'POST',
            body: JSON.stringify({ sessionId: res.session.id }),
          }, null)
            .then(() => {
              consecutiveFailures = 0;
              if (active) setHeartbeatFailures(0);
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : '';

              // Displaced session: another device started streaming — stop immediately
              // and show a specific message instead of the generic circuit breaker.
              if (msg === 'session_not_found' || msg === 'forbidden') {
                if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
                if (active) {
                  setHeartbeatFailures(MAX_HEARTBEAT_FAILURES); // trigger overlay
                  toast.error(
                    'Your stream was opened on another device. Only one device can stream at a time.',
                    { duration: 10_000 }
                  );
                }
                return;
              }

              consecutiveFailures++;
              if (active) setHeartbeatFailures(consecutiveFailures);
              if (consecutiveFailures >= MAX_HEARTBEAT_FAILURES && heartbeatId) {
                clearInterval(heartbeatId);
                heartbeatId = null;
                if (active) toast.error('Connection lost. Refresh to reconnect.');
              }
            });
        }, hbMs);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Map known worker error codes to actionable messages.
        // Previously super-admin errors were silently swallowed, causing a
        // blank black screen with no indication of what was wrong.
        if (msg === 'empty_stream_url') {
          setPlayerError(
            isSuperAdmin
              ? 'No stream URL configured — open Broadcast Controls to add one'
              : 'Stream starting soon',
          );
        } else if (msg === 'stream_offline') {
          setPlayerError(
            isSuperAdmin ? 'Stream is marked offline' : 'Stream is starting soon',
          );
        } else {
          setPlayerError(
            isSuperAdmin
              ? `Could not start session: ${msg} — check Broadcast Controls`
              : 'Unable to start secure playback session.',
          );
          if (!isSuperAdmin) toast.error('Unable to start secure playback session.');
        }
      } finally {
        if (active) setPlaybackLoading(false);
      }
    };
    void start();
    return () => {
      active = false;
      if (heartbeatId) clearInterval(heartbeatId);
      if (hardCapTimerId) clearTimeout(hardCapTimerId);
      if (sessionIdForCleanup) {
        void apiFetch(game.id === 'broadcast' ? '/api/broadcast/session/end' : `/api/streams/${game.id}/session/end`, {
          method: 'POST',
          body: JSON.stringify({ sessionId: sessionIdForCleanup }),
        }, null).catch(() => {});
      }
    };
    // retryKey is intentionally included: clicking Retry bumps it to re-run
    // the session start without a full page reload.
  }, [hasAccess, userId, game.id, isSuperAdmin, retryKey]);

  // ── Gate 1: Unregistered ─────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-6 text-center gap-4 overflow-y-auto py-6">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <h2 className="font-display text-2xl font-bold">Register to Watch</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Create a free SBBL HQ account to access live streams. You'll be able
          to enter an access code right after signing in.
        </p>
        <Link
          to="/register?redirect=/live"
          className="bg-amber-500 hover:bg-amber-400 text-black px-7 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors shadow-md"
        >
          Create Free Account
        </Link>
        <p className="text-xs text-muted-foreground">
          Already registered?{' '}
          <Link to="/login?redirect=/live" className="text-amber-500 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // ── Loading: waiting for server-side entitlement check ───────────────────
  if (!accessChecked && !hasRoleAccess) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Gate 2: Access granted → Player ──────────────────────
  if (hasAccess) {
    const providerHint = playbackTypeHint && playbackTypeHint !== 'unknown'
      ? playbackTypeHint
      : null;
    return (
      <div className="absolute inset-0 flex flex-col z-0">
        {/* Stream Player Area */}
        {playbackLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : playerError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
              <Play className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-white/80 font-medium mb-1">Stream Unavailable</p>
            <p className="text-xs text-white/50 mb-4">{playerError}</p>
            <button
              onClick={() => { setPlayerError(null); setRetryKey(k => k + 1); }}
              className="px-4 py-2 text-xs font-display font-bold uppercase tracking-wider bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : playbackUrl ? (
          <StreamPlayer
            url={playbackUrl}
            isSuperAdmin={isSuperAdmin}
            providerHint={providerHint}
            onReady={() => { sf.reportEvent('play'); sf.recordSuccess(); }}
            onPlay={() => sf.reportEvent('playing')}
            onError={(message) => { setPlayerError(message); sf.recordFailure(); }}
          />
        ) : null}

        {/* Connection lost / displaced banner — circuit breaker triggered.
            Suppressed for super admin: they never get displaced or kicked. */}
        {!isSuperAdmin && heartbeatFailures >= MAX_HEARTBEAT_FAILURES && (
          <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6 gap-4">
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
              <Lock className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white mb-1">Stream Ended on This Device</h3>
              <p className="text-sm text-white/60 max-w-xs leading-relaxed">
                Only one device can stream at a time per account. To watch here, sign in on this device and start a new session.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors"
            >
              Resume on This Device
            </button>
          </div>
        )}

        {/* Offline overlay — shown when admin hasn't started the stream.
            Hidden for super admin so they can preview/test the player even
            before flipping the stream live. */}
        {isStreamLive === false && !isSuperAdmin && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center text-center z-10">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-bold mb-1">Stream Starting Soon</h3>
            <p className="text-sm text-muted-foreground mb-3">The broadcast will begin shortly. Stay tuned.</p>
          </div>
        )}

        {/* Invite generator: shown to eligible roles only */}
        {canGenerateInvite && (
          <div className="absolute bottom-4 right-4 z-10">
            {generatedCode ? (
              <div className="bg-background/90 backdrop-blur-sm border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                <Ticket className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Fan Invite
                  </span>
                  <code className="font-mono text-sm text-amber-500 font-bold tracking-wide">
                    {generatedCode.slice(0, 8).toUpperCase()}…
                  </code>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2500);
                    toast.success('Full invite code copied — share with one fan');
                  }}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  aria-label="Copy full invite code"
                  title="Copy full invite code"
                >
                  {codeCopied
                    ? <Check className="w-4 h-4 text-green-500" />
                    : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            ) : (
              <button
                disabled={generatingInvite}
                onClick={async () => {
                  setGeneratingInvite(true);
                  try {
                    const res = await apiFetch<{ code: string; reused?: boolean }>(
                      '/api/invite/generate',
                      {
                        method: 'POST',
                        body: JSON.stringify({ gameId: game.id }),
                      },
                      null,
                    );
                    setGeneratedCode(res.code);
                    toast.success(
                      res.reused
                        ? 'Your existing invite code loaded'
                        : 'Invite code generated — share with one fan (24h, IP-locked)',
                    );
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    if (msg === 'already_generated') {
                      toast.error('You already generated an invite for this game');
                    } else if (msg === 'forbidden') {
                      toast.error('Your account is not eligible to generate invites');
                    } else {
                      toast.error('Could not generate invite. Try again.');
                    }
                  } finally {
                    setGeneratingInvite(false);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors disabled:opacity-60 shadow-xl"
              >
                <Ticket className="w-3.5 h-3.5" />
                {generatingInvite ? 'Generating…' : 'Generate Fan Invite'}
              </button>
            )}
          </div>
        )}

        {/* RBAC role badge — bottom-left, visible when stream is playing */}
        {playbackUrl && !playerError && !playbackLoading && (
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none select-none">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm border ${
              isSuperAdmin
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400/90'
                : isPlayer
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300/80'
                  : 'bg-white/5 border-white/15 text-white/50'
            }`}>
              {isSuperAdmin ? 'Admin Access' : isPlayer ? 'Player Access' : 'Fan Access'}
            </span>
          </div>
        )}

        {/* Watermark */}
        <div className="absolute top-4 right-4 text-[10px] text-white/10 font-mono pointer-events-none select-none">
          SESSION-BOUND · {userId.slice(0, 8).toUpperCase()}
        </div>
      </div>
    );
  }

  // ── Gate 3: Preview — registered fan with no access ───────────────────────
  return (
    <div className="absolute inset-0">
      {/* Hidden Turnstile widget — executed before PPV purchase or invite redeem */}
      <div ref={turnstileRef} className="sr-only" aria-hidden="true" />
      <img
        src={gameAction}
        alt="Game preview"
        className="w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 gap-4">
        <LeagueBadge leagueId={game.leagueId} size="md" />

        <div className="mt-2">
          <span className="stat-numeral text-3xl md:text-4xl">{game.homeTeam.name}</span>
          <span className="stat-numeral text-3xl md:text-4xl text-primary mx-3">
            {game.score?.home} — {game.score?.away}
          </span>
          <span className="stat-numeral text-3xl md:text-4xl">{game.awayTeam.name}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {game.venue} · {game.court} · Live
        </p>

        {/* PPV purchase */}
        <button
          disabled={purchasing}
          onClick={async () => {
            setPurchasing(true);
            try {
              const res = await apiFetch<{ url: string }>(
                `/api/streams/${game.id}/purchase`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    successUrl: `${globalThis.location.origin}/live?access=1`,
                    cancelUrl: `${globalThis.location.origin}/live`,
                    captchaToken: await resolveToken(),
                  }),
                },
                null,
              );
              if (res.url) globalThis.location.href = res.url;
            } catch {
              toast.error('Could not start checkout. Please try again.');
            } finally {
              setPurchasing(false);
            }
          }}
          className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors disabled:opacity-60 shadow-md"
        >
          <Play className="w-4 h-4" />
          {purchasing ? 'Redirecting…' : `Purchase Access — $${PPV_PRICE_TOTAL.toFixed(2)} CAD (incl. GST)`}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <hr className="flex-1 border-border" />
          <span className="text-[11px] text-muted-foreground">or</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Access code redemption — works with comp codes and regular invites.
            The server derives the gameId from the code, so viewers don't need
            to know anything beyond the token itself. */}
        <AccessCodeRedeem
          variant="light"
          onRedeemed={() => {
            setInviteGranted(true);
            setTimeout(() => window.location.reload(), 400);
          }}
        />
      </div>
    </div>
  );
}
