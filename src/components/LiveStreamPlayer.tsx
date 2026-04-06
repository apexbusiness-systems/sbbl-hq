import { WhepPlayer } from '@/components/WhepPlayer';
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
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Play, Ticket, Copy, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import ReactPlayer from 'react-player';
import { apiFetch } from '@/lib/api/client';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import gameAction from '@/assets/game-action.svg';
import type { Game } from '@/types';
import type { AppRole } from '@/lib/auth/roles';

const PPV_PRICE_USD = 4.99;

// Legacy Switcher Studio config removed.
// ReactPlayer stream URL is configured via AdminStreamControls.

interface LiveStreamPlayerProps {
  game: Game;
  userId: string | null;
  roles: AppRole[];
  token: string | null;
  hasPremiumPlayerAccess: boolean;
  /** Whether admin has set stream to live */
  isStreamLive?: boolean;
}

export function LiveStreamPlayer({
  game,
  userId,
  roles,
  token,
  hasPremiumPlayerAccess,
  isStreamLive,
}: LiveStreamPlayerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ppvEntitled, setPpvEntitled] = useState(false);
  const [inviteGranted, setInviteGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [purchasing, setPurchasing] = useState(false);

  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [inviteInput, setInviteInput] = useState('');
  const [redeemingInvite, setRedeemingInvite] = useState(false);

  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileWaitRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  // ── Role classification ──────────────────────────────────────────────────
  const isPaidFan   = roles.includes('paid_fan');
  const isSuperAdmin = roles.includes('super_admin');

  // "Registered Players have access to this when their membership is not expired yet"
  // hasPremiumPlayerAccess prop handles (role === 'player' && !expired) || isAdmin.
  const hasRoleAccess = hasPremiumPlayerAccess || isPaidFan;
  const canGenerateInvite = hasPremiumPlayerAccess || isPaidFan || isSuperAdmin;
  const hasAccess = hasRoleAccess || ppvEntitled || inviteGranted;

  useEffect(() => {
    const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
    if (!siteKey || !turnstileContainerRef.current) return;
    const mountWidget = () => {
      const turnstile = (window as unknown as { turnstile?: { render: (...args: unknown[]) => string } }).turnstile;
      if (!turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (tokenValue: string) => {
          turnstileWaitRef.current?.resolve(tokenValue);
          turnstileWaitRef.current = null;
        },
        'error-callback': () => {
          turnstileWaitRef.current?.reject(new Error('captcha_failed'));
          turnstileWaitRef.current = null;
        },
        'expired-callback': () => undefined,
      } as unknown as Record<string, unknown>);
    };
    if ((window as unknown as { turnstile?: unknown }).turnstile) {
      mountWidget();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', mountWidget);
    document.head.appendChild(script);
    return () => script.removeEventListener('load', mountWidget);
  }, []);

  async function resolveCaptchaToken() {
    const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
    if (!siteKey) return undefined;
    const turnstile = (window as unknown as { turnstile?: { execute: (id: string) => void; reset: (id: string) => void } }).turnstile;
    if (!turnstile || !turnstileWidgetIdRef.current) throw new Error('captcha_loading');
    turnstile.reset(turnstileWidgetIdRef.current);
    return await new Promise<string>((resolve, reject) => {
      turnstileWaitRef.current = { resolve, reject: (error) => reject(error) };
      turnstile.execute(turnstileWidgetIdRef.current!);
      window.setTimeout(() => {
        if (turnstileWaitRef.current) {
          turnstileWaitRef.current.reject(new Error('captcha_timeout'));
          turnstileWaitRef.current = null;
        }
      }, 15000);
    });
  }

  // ── Fetch stream entitlement (skip if role already grants access) ─────────
  useEffect(() => {
    if (!userId || hasRoleAccess) {
      setAccessChecked(true);
      return;
    }

    apiFetch<{ hasAccess: boolean }>(`/api/streams/${game.id}/access`, {}, token)
      .then(res => {
        if (res.hasAccess) setPpvEntitled(true);
      })
      .catch(() => { /* network error — stay in preview; user can retry purchase */ })
      .finally(() => setAccessChecked(true));
  }, [userId, game.id, hasRoleAccess, token]);

  async function handlePurchase() {
    setPurchasing(true);
    try {
      const res = await apiFetch<{ url: string }>(
        `/api/streams/${game.id}/purchase`,
        {
          method: 'POST',
          body: JSON.stringify({
            ppvPrice: PPV_PRICE_USD,
            successUrl: `${window.location.origin}/live?access=1`,
            cancelUrl: `${window.location.origin}/live`,
            captchaToken: await resolveCaptchaToken(),
          }),
        },
        token,
      );
      if (res.url) window.location.href = res.url;
    } catch {
      toast.error('Could not start checkout. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  useEffect(() => {
    const autoCheckoutId = searchParams.get('checkout');
    if (userId && accessChecked && !hasAccess && autoCheckoutId === game.id && !purchasing) {
      setSearchParams(prev => {
        prev.delete('checkout');
        return prev;
      }, { replace: true });
      void handlePurchase();
    }
  }, [userId, accessChecked, hasAccess, searchParams, game.id, purchasing, setSearchParams]);

  useEffect(() => {
    if (!hasAccess || !userId || !token) return;
    let active = true;
    let heartbeatId: number | null = null;
    let sessionIdForCleanup: string | null = null;
    setPlaybackLoading(true);
    const sessionKey = `playback-${game.id}`;
    const start = async () => {
      try {
        const res = await apiFetch<{
          playback: { url: string; heartbeatIntervalSec: number };
          session: { id: string };
        }>(`/api/streams/${game.id}/session`, {
          method: 'POST',
          body: JSON.stringify({ sessionKey }),
        }, token);
        if (!active) return;
        setPlaybackUrl(res.playback.url);
        sessionIdForCleanup = res.session.id;
        const hbMs = Math.max(10000, res.playback.heartbeatIntervalSec * 1000);
        heartbeatId = window.setInterval(() => {
          void apiFetch(`/api/streams/${game.id}/session/heartbeat`, {
            method: 'POST',
            body: JSON.stringify({ sessionId: res.session.id }),
          }, token).catch(() => {});
        }, hbMs);
      } catch {
        if (active) toast.error('Unable to start secure playback session.');
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
        }, token).catch(() => {});
      }
    };
  }, [hasAccess, userId, token, game.id]);

  // ── Gate 1: Unregistered ─────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Livestream player access is for registered users only</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Sign up to unlock the livestream player and access live events.
        </p>
        <Link
          to={`/register?redirect=${encodeURIComponent(`/live${(game.ppvPrice ?? PPV_PRICE_USD) > 0 ? `?checkout=${game.id}` : ''}`)}`}
          className="bg-amber-500 hover:bg-amber-400 text-black px-7 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors shadow-md"
        >
          Sign Up
        </Link>
        <p className="mt-4 text-xs text-muted-foreground">
          Already registered?{' '}
          <Link to="/login" className="text-amber-500 hover:underline">
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
        ) : playbackUrl ? (
          <div className="absolute inset-0 pointer-events-auto">
            <ReactPlayer
              url={playbackUrl}
              playing={true}
              controls={true}
              width="100%"
              height="100%"
              config={{
                twitch: {
                  options: {
                    parent: ['sbbl-hq.icu', 'www.sbbl-hq.icu', 'localhost']
                  }
                },
                youtube: {
                  playerVars: { modestbranding: 1, rel: 0, showinfo: 0, controls: 1 }
                }
              }}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-sm text-muted-foreground">Admin has not provided a stream URL.</p>
          </div>
        )}

        {/* Offline overlay — shown when admin hasn't started the stream */}
        {isStreamLive === false && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center text-center z-10">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-bold mb-1">Stream Starting Soon</h3>
            <p className="text-sm text-muted-foreground">The broadcast will begin shortly. Stay tuned.</p>
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
          <div ref={turnstileContainerRef} className="sr-only" aria-hidden />
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
                      token,
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

  // ── Gate 3: Membership Expired ───────────────────────────────────────────
  // If user is a player but the 'hasPremiumPlayerAccess' is false, they are expired.
  const isPlayer = roles.includes('player');
  if (isPlayer && !hasPremiumPlayerAccess && !ppvEntitled && !inviteGranted) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0D0D] px-6 text-center border-2 border-primary/20">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 border border-destructive/20 animate-pulse">
          <Lock className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="font-display text-3xl font-bold mb-3 uppercase tracking-tight text-foreground">Membership Expired</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
          Your SBBL Player membership has expired. Renew your subscription to restore full access to live streams, stats, and premium features.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link
            to="/settings/billing"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(201,168,76,0.2)]"
          >
            Renew Now
          </Link>
          <button
            onClick={() => void handlePurchase()}
            className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-sm inline-flex items-center justify-center gap-2 transition-all border border-border"
          >
            Buy PPV — ${PPV_PRICE_USD.toFixed(2)}
          </button>
        </div>
      </div>
    );
  }

  // ── Gate 4: Premium Paywall — registered fan with no access ───────────────
  return (
    <div className="absolute inset-0 bg-[#050505] overflow-hidden group">
      {/* Background Image Enhancement */}
      <div className="absolute inset-0 scale-110 blur-sm opacity-20 transition-transform duration-[10s] group-hover:scale-100">
        <img src={gameAction} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
      
      {/* High Contrast UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-12 z-20">
        <div className="mb-8 transform transition-transform duration-700 hover:scale-110">
          <LeagueBadge leagueId={game.leagueId} size="lg" />
        </div>

        <div className="space-y-4 mb-10 w-full max-w-2xl px-4">
          {/* Paywall Title */}
          <div className="mb-8">
            <h2 className="font-display text-2xl md:text-5xl font-black uppercase tracking-tighter text-white transition-all drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              Livestream Player Access
            </h2>
            <div className="h-1 w-24 bg-primary mx-auto mt-3 rounded-full" />
          </div>

          <div className="flex items-center justify-center gap-4 md:gap-12">
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="font-display text-2xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">
                {game.homeTeam.name}
              </span>
            </div>
            <div className="flex flex-col items-center bg-primary/10 px-5 py-3 rounded-sm border border-primary/20 backdrop-blur-md">
              <span className="font-mono text-3xl md:text-5xl font-bold text-primary tracking-tighter">
                {game.score?.home ?? 0} — {game.score?.away ?? 0}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 mt-1">Live Score</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="font-display text-2xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">
                {game.awayTeam.name}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
              {game.venue} · {game.court} · Broadcast Level Coverage
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* Main CTA */}
          <button
            disabled={purchasing}
            onClick={() => void handlePurchase()}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 font-display font-bold text-base uppercase tracking-[0.1em] rounded-sm inline-flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(201,168,76,0.25)] relative overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500" />
            <Play className="w-5 h-5 fill-current" />
            {purchasing ? 'Redirecting to Checkout…' : `Watch Live HD — $${PPV_PRICE_USD.toFixed(2)}`}
          </button>

          {/* Secondary Redemption */}
          <div className="w-full space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 font-mono">Invite Code Redemption</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2 p-1.5 bg-white/[0.03] border border-white/10 rounded-sm">
              <input
                type="text"
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value.trim())}
                onKeyDown={e => { if (e.key === 'Enter' && inviteInput && !redeemingInvite) void handleRedeem(); }}
                placeholder="ENTER INVITE CODE"
                maxLength={36}
                className="flex-1 bg-transparent px-4 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none tracking-widest"
                aria-label="Invite code"
              />
              <button
                disabled={!inviteInput || redeemingInvite}
                onClick={() => void handleRedeem()}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-20 flex items-center gap-2"
              >
                {redeemingInvite ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    Apply
                  </>
                )}
              </button>
            </div>
          </div>
          
          <p className="text-[10px] text-muted-foreground/40 font-medium leading-relaxed max-w-[280px]">
            Session access only. Invite codes are IP-locked, single-use, and expire in 24&nbsp;hours.
          </p>
        </div>
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10" style={{ backgroundSize: '100% 4px, 3px 100%' }} />
    </div>
  );

  // ── Invite redemption handler (hoisted for key-down + button reuse) ────────
  async function handleRedeem() {
    setRedeemingInvite(true);
    try {
      await apiFetch<{ granted: boolean }>(
        '/api/invite/redeem',
        {
          method: 'POST',
          body: JSON.stringify({
            code: inviteInput,
            gameId: game.id,
            captchaToken: await resolveCaptchaToken(),
          }),
        },
        token,
      );
      setInviteGranted(true);
      toast.success('Invite accepted — enjoy the game!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'ip_mismatch' || msg === 'non_transferable') {
        toast.error('This invite cannot be used from your device or location.');
      } else if (msg === 'expired') {
        toast.error('This invite code has expired (24-hour window).');
      } else if (msg === 'invalid_invite') {
        toast.error('Invite code not found. Check for typos.');
      } else if (msg === 'cannot_redeem_own_invite') {
        toast.error('You cannot redeem an invite you generated.');
      } else {
        toast.error('Could not redeem invite. Please try again.');
      }
    } finally {
      setRedeemingInvite(false);
    }
  }
}
