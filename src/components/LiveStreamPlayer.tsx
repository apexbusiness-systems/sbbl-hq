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
  customStreamUrl?: string;
}

export function LiveStreamPlayer({
  game,
  userId,
  roles,
  token,
  hasPremiumPlayerAccess,
  isStreamLive,
  customStreamUrl = '',
}: LiveStreamPlayerProps) {
  const [ppvEntitled, setPpvEntitled] = useState(false);
  const [inviteGranted, setInviteGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [purchasing, setPurchasing] = useState(false);

  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [inviteInput, setInviteInput] = useState('');
  const [redeemingInvite, setRedeemingInvite] = useState(false);

  const embedRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  // ── Role classification ──────────────────────────────────────────────────
  const isPlayer    = roles.includes('player');
  const isPaidFan   = roles.includes('paid_fan');
  const isSuperAdmin = roles.includes('super_admin');

  const hasRoleAccess = isPlayer || isPaidFan || isSuperAdmin;
  const canGenerateInvite = hasPremiumPlayerAccess || isPaidFan || isSuperAdmin;
  const hasAccess = hasRoleAccess || ppvEntitled || inviteGranted;

  // ── No third-party embed scripts required ─────────────────────────────
  // ReactPlayer handles HLS/YouTube/Twitch natively.

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

  // ── Gate 1: Unregistered ─────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Register to Watch</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Create a free SBBL HQ account to access live streams. Guests can enter
          an invite code after registering.
        </p>
        <Link
          to="/register?redirect=/live"
          className="bg-amber-500 hover:bg-amber-400 text-black px-7 py-3 font-display font-bold text-sm uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors shadow-md"
        >
          Create Free Account
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
        {customStreamUrl ? (
          <div className="absolute inset-0 pointer-events-auto">
            <ReactPlayer
              url={customStreamUrl}
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

  // ── Gate 3: Preview — registered fan with no access ───────────────────────
  return (
    <div className="absolute inset-0">
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
                    ppvPrice: PPV_PRICE_USD,
                    successUrl: `${window.location.origin}/live?access=1`,
                    cancelUrl: `${window.location.origin}/live`,
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
          }}
          className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-3.5 font-display font-bold text-sm uppercase tracking-wider rounded-2xl inline-flex items-center gap-2 transition-colors disabled:opacity-60 shadow-md"
        >
          <Play className="w-4 h-4" />
          {purchasing ? 'Redirecting…' : `Purchase Access — $${PPV_PRICE_USD.toFixed(2)}`}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <hr className="flex-1 border-border" />
          <span className="text-[11px] text-muted-foreground">or</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Invite code redemption */}
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <p className="text-xs text-muted-foreground">Have an invite code?</p>
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value.trim())}
              onKeyDown={e => { if (e.key === 'Enter' && inviteInput && !redeemingInvite) void handleRedeem(); }}
              placeholder="Paste invite code…"
              maxLength={36}
              className="flex-1 bg-secondary px-3 py-2 text-xs rounded-sm border border-border focus:outline-none focus:border-amber-500/50 font-mono"
              aria-label="Invite code"
            />
            <button
              disabled={!inviteInput || redeemingInvite}
              onClick={() => void handleRedeem()}
              className="px-3 py-2 text-xs bg-secondary border border-border rounded-sm hover:border-amber-500/50 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {redeemingInvite ? '…' : 'Redeem'}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
          Session access only. Invite codes are IP-locked, single-use, and expire in 24&nbsp;hours.
        </p>
      </div>
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
          body: JSON.stringify({ code: inviteInput, gameId: game.id }),
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
