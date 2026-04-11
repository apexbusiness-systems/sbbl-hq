/**
 * LiveStreamPlayer.tsx
 * Renders the live-stream broadcast area with a multi-layer access gate:
 *
 *   Unregistered (no auth.user)           → registration wall → /register?redirect=/live
 *   player role                           → free access always → Switcher Studio player
 *   paid_fan | super_admin                → free access + invite generator → player
 *   fan with PPV entitlement (Stripe)     → access → player
 *   fan with redeemed invite              → access → player
 *   fan with no access                    → preview gate → PPV buy ($4.99) + invite redeem
 *
 * IP locking and single-use enforcement happen server-side in /api/invite/redeem.
 * No role/entitlement data is trusted from the client.
 *
 * Uses Switcher Studio's script-based embed player.
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Play, Ticket, Copy, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import ReactPlayer from 'react-player';
import { apiFetch } from '@/lib/api/client';
import { redeemAccessCode } from '@/lib/api/stream';
import { useTurnstile } from '@/hooks/use-turnstile';
import { useStreamForge } from '@/hooks/use-streamforge';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import {
  computeRetryDelayMs,
  DEFAULT_STREAM_RETRY_POLICY,
  detectNetworkTier,
  isRecoverablePlaybackError,
} from '@/lib/stream-reliability';
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
}: {
  variant?: 'dark' | 'light';
  onRedeemed?: () => void;
}) {
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
        { captchaToken: await resolveToken() },
        null,
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

const PPV_PRICE_CAD = 4.99;
const ALBERTA_GST = 0.05;
/** Tax-inclusive price shown to Alberta viewers */
const PPV_PRICE_TOTAL = Math.round(PPV_PRICE_CAD * (1 + ALBERTA_GST) * 100) / 100;

// Legacy Switcher Studio config removed.
// ReactPlayer stream URL is configured via AdminStreamControls.

/**
 * Normalize Facebook Live URLs:
 * - Strip fbclid tracking parameter that breaks embed playback
 * - Ensure /live/ suffix is present for direct FB Live embeds
 */
function normalizeFacebookUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('facebook.com')) return url;
    u.searchParams.delete('fbclid');
    return u.toString();
  } catch {
    return url;
  }
}

const DEVICE_TOKEN_KEY = 'sbbl:stream-device-token:v1';

function getOrCreateDeviceToken(): string {
  const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing && existing.length >= 16) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_TOKEN_KEY, generated);
  return generated;
}

interface LiveStreamPlayerProps {
  game: Game;
  userId: string | null;
  roles: AppRole[];
  hasPremiumPlayerAccess: boolean;
  /** Whether admin has set stream to live */
  isStreamLive?: boolean;
}

export function LiveStreamPlayer({
  game,
  userId,
  roles,
  hasPremiumPlayerAccess,
  isStreamLive,
}: LiveStreamPlayerProps) {
  const [ppvEntitled, setPpvEntitled] = useState(false);
  const [inviteGranted, setInviteGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [purchasing, setPurchasing] = useState(false);

  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);


  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerRestartNonce, setPlayerRestartNonce] = useState(0);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [heartbeatFailures, setHeartbeatFailures] = useState(0);
  const recoveryTimerRef = useRef<number | null>(null);
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

  // Detect Facebook stream URLs so we can lock down the embed for non-admins
  const isFacebookStream = /facebook\.com|fb\.watch/i.test(playbackUrl);

  const hasRoleAccess = isPlayer || isPaidFan || isSuperAdmin;
  const canGenerateInvite = hasPremiumPlayerAccess || isPaidFan || isSuperAdmin;
  const hasAccess = hasRoleAccess || ppvEntitled || inviteGranted;

  // ── Fetch stream entitlement (skip if role already grants access) ─────────
  // Pass null instead of explicit token — apiFetch auto-fetches a fresh JWT
  // via getAuthToken(), preventing stale-token 401 loops.
  useEffect(() => {
    if (!userId || hasRoleAccess) {
      setAccessChecked(true);
      return;
    }

    apiFetch<{ hasAccess: boolean }>(`/api/streams/${game.id}/access`, {}, null)
      .then(res => {
        if (res.hasAccess) setPpvEntitled(true);
      })
      .catch(() => { /* network error — stay in preview; user can retry purchase */ })
      .finally(() => setAccessChecked(true));
  }, [userId, game.id, hasRoleAccess]);

  // Start playback session — all API calls use null token so apiFetch
  // auto-refreshes the JWT, preventing stale-token 401 loops.
  // Circuit breaker: after 3 consecutive heartbeat failures, notify the
  // viewer and stop the heartbeat interval to prevent battery drain.
  const MAX_HEARTBEAT_FAILURES = 3;

  useEffect(() => {
    if (!hasAccess || !userId) return;
    let active = true;
    let heartbeatId: number | null = null;
    let sessionIdForCleanup: string | null = null;
    let consecutiveFailures = 0;
    setPlaybackLoading(true);
    setPlayerReady(false);
    setPlayerError(null);
    setHeartbeatFailures(0);
    const deviceToken = getOrCreateDeviceToken();
    const sessionKey = `playback-${game.id}-${deviceToken}`;
    const start = async () => {
      try {
        const res = await apiFetch<{
          playback: { url: string; heartbeatIntervalSec: number; maxExpiresAt?: string };
          session: { id: string; maxExpiresAt?: string };
        }>(`/api/streams/${game.id}/session`, {
          method: 'POST',
          body: JSON.stringify({ sessionKey }),
        }, null);
        if (!active) return;
        setPlaybackUrl(normalizeFacebookUrl(res.playback.url));
        sessionIdForCleanup = res.session.id;
        const hbMs = Math.max(10000, res.playback.heartbeatIntervalSec * 1000);

        // 6-hour hard cap: schedule auto-termination at maxExpiresAt
        if (res.session.maxExpiresAt) {
          const msUntilCap = new Date(res.session.maxExpiresAt).getTime() - Date.now();
          if (msUntilCap > 0) {
            setTimeout(() => {
              if (!active) return;
              if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
              toast.error('Your 6-hour viewing session has ended. Purchase a new pass to continue.');
            }, msUntilCap);
          }
        }
        heartbeatId = window.setInterval(() => {
          void apiFetch(`/api/streams/${game.id}/session/heartbeat`, {
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
      } catch {
        // Silent for super admin — the worker super-admin fast-path should
        // never fail, and if it does the admin will see it in dev-tools. For
        // regular users, surface the generic error.
        if (active && !isSuperAdmin) {
          toast.error('Unable to start secure playback session.');
        }
      } finally {
        if (active) setPlaybackLoading(false);
      }
    };
    void start();
    return () => {
      active = false;
      if (heartbeatId) clearInterval(heartbeatId);
      if (sessionIdForCleanup) {
        void apiFetch(`/api/streams/${game.id}/session/end`, {
          method: 'POST',
          body: JSON.stringify({ sessionId: sessionIdForCleanup }),
        }, null).catch(() => {});
      }
    };
  }, [hasAccess, userId, game.id, isSuperAdmin]);

  useEffect(() => {
    if (!hasAccess) return;
    const onOnline = () => {
      if (!playerError) return;
      setPlayerError(null);
      setRecoveryPending(false);
      setRecoveryAttempt(0);
      setPlayerRestartNonce(prev => prev + 1);
      toast.success('Network restored — reconnecting stream…');
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [hasAccess, playerError]);

  useEffect(() => {
    return () => {
      // Prevent stale timer callbacks from mutating unmounted player state.
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
    };
  }, []);

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
    return (
      <div className="absolute inset-0 flex flex-col relative z-0">
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
              onClick={() => {
                setPlayerError(null);
                setPlayerReady(false);
                setRecoveryPending(false);
                setRecoveryAttempt(0);
                setPlayerRestartNonce(prev => prev + 1);
              }}
              className="px-4 py-2 text-xs font-display font-bold uppercase tracking-wider bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : playbackUrl ? (
          <div className="absolute inset-0 pointer-events-auto">
            {!playerReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <ReactPlayer
              key={playerRestartNonce}
              url={playbackUrl}
              playing={true}
              muted={true}
              controls={true}
              width="100%"
              height="100%"
              onReady={() => {
                setPlayerReady(true);
                setRecoveryAttempt(0);
                setRecoveryPending(false);
              }}
              onError={(e) => {
                console.error('[ReactPlayer] Stream error:', e);
                const reason = e instanceof Error
                  ? e.message
                  : typeof e === 'string'
                    ? e
                    : 'unknown_playback_error';
                const errorMessage = `The stream source could not be loaded (${reason}).`;
                setPlayerError(errorMessage);
                if (recoveryPending) return;
                if (!isRecoverablePlaybackError(errorMessage)) return;
                if (recoveryAttempt >= DEFAULT_STREAM_RETRY_POLICY.maxAttempts) return;

                const connection = (navigator as Navigator & { connection?: { downlink?: number; effectiveType?: string; saveData?: boolean } }).connection;
                const networkTier = detectNetworkTier(connection ?? null);
                const delay = computeRetryDelayMs(recoveryAttempt + 1);
                const tierDelay = networkTier === 'constrained' ? Math.round(delay * 1.5) : delay;
                setRecoveryPending(true);
                if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
                recoveryTimerRef.current = window.setTimeout(() => {
                  setPlayerError(null);
                  setRecoveryPending(false);
                  setRecoveryAttempt(prev => prev + 1);
                  setPlayerRestartNonce(prev => prev + 1);
                }, tierDelay);
              }}
              config={{
                twitch: {
                  options: {
                    parent: ['sbbl-hq.icu', 'www.sbbl-hq.icu', 'localhost'],
                    muted: true,
                  }
                },
                youtube: {
                  playerVars: { modestbranding: 1, rel: 0, showinfo: 0, controls: 1, mute: 1 }
                },
                facebook: {
                  appId: import.meta.env.VITE_FACEBOOK_APP_ID || '',
                  version: 'v18.0',
                  playerId: 'sbbl-fb-player',
                }
              }}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
            {/* Block Facebook UI navigation for non-super-admin viewers.
                The video autoplays via playing={true} so they can still watch;
                this overlay only prevents clicking into Facebook's feed/related
                videos. Super admins get the full embed for monitoring purposes. */}
            {isFacebookStream && !isSuperAdmin && (
              <div
                className="absolute inset-0 z-10"
                aria-hidden="true"
                style={{ pointerEvents: 'all', background: 'transparent', cursor: 'default' }}
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
            <p className="text-sm text-muted-foreground">Live game found, but no playable stream URL is configured.</p>
          </div>
        )}

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
                    successUrl: `${window.location.origin}/live?access=1`,
                    cancelUrl: `${window.location.origin}/live`,
                    captchaToken: await resolveToken(),
                  }),
                },
                null,
              );
              if (res.url) window.location.href = res.url;
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
