import { FormEvent, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { saveOnboarding } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase/client';
import { LEAGUE_REGISTRY } from '@/lib/leagues';

type RoleIntent = 'fan' | 'player' | 'coach';

const ROLE_OPTIONS: { value: RoleIntent; label: string; description: string }[] = [
  {
    value: 'fan',
    label: 'Fan',
    description: 'Follow games, watch streams, and engage with the league.',
  },
  {
    value: 'player',
    label: 'Player — $6.99 CAD/month + GST',
    description: 'Register as a player. Includes stats, leaderboard, player profile, highlight downloads, and a 10% store discount. Billed monthly.',
  },
  {
    value: 'coach',
    label: 'Coach — Free, pending approval',
    description: 'Request coach access. A league admin will review and approve your request.',
  },
];

const OnboardingPage = () => {
  const { user, isSignedIn, isAdmin, needsOnboarding, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(location.search);
  // ?intent=fan drives straight into the fan branch (skip role picker pre-selection)
  const intentParam = urlParams.get('intent');
  const redirectTarget = urlParams.get('redirect') ?? '/live';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachSubmitted, setCoachSubmitted] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    fullName: '',
    primaryRoleIntent: 'fan' as RoleIntent,
    preferredLeague: 'SBBL',
    bio: '',
    avatarFile: null as File | null,
  });

  if (loading) return <div className="container py-10 text-sm text-muted-foreground">Loading…</div>;

  if (!isSignedIn || !user) {
    // Preserve intent + redirect so the fan paywall flow survives the sign-in round-trip.
    // Only inject ?intent= if it was explicitly present — never default to fan for bare /onboarding.
    const onboardingQs = new URLSearchParams();
    if (intentParam) onboardingQs.set('intent', intentParam);
    onboardingQs.set('redirect', redirectTarget);
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/onboarding?${onboardingQs.toString()}`)}`} replace />;
  }

  if (!needsOnboarding) return <Navigate to={isAdmin ? '/ops' : redirectTarget} replace />;

  // Fan mode: active when intent=fan OR user selected fan role
  const isFan = form.primaryRoleIntent === 'fan';

  if (coachSubmitted) {
    return (
      <div className="container max-w-lg py-16 text-center">
        <div className="panel p-8">
          <h1 className="font-display text-2xl text-primary mb-3">Coach Request Submitted</h1>
          <p className="text-muted-foreground text-sm">
            Your account is active. A league admin will review your coach request shortly.
            You will be notified once approved.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 gold-bg px-6 py-2 rounded-sm font-semibold text-sm"
          >
            Continue to App
          </button>
        </div>
      </div>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Fan path: only display_name required; no bio or avatar collected.
    if (isFan) {
      if (!form.displayName.trim()) {
        setError('Display name is required.');
        return;
      }
    } else {
      if (!form.displayName.trim() || !form.fullName.trim()) {
        setError('Display name and full name are required.');
        return;
      }
    }

    try {
      setError(null);
      setSubmitting(true);

      if (isFan) {
        // Fan path: use complete_fan_onboarding() RPC — never sets bio or avatar_url.
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase client unavailable');

        const payload = {
          p_display_name: form.displayName.trim(),
          p_full_name: form.fullName.trim() || null,
          p_preferred_league: form.preferredLeague || null,
        };

        const { data, error: rpcError } = await supabase.rpc('complete_fan_onboarding', payload);

        if (rpcError) {
          const rpcMessage = rpcError.message.toLowerCase();
          const rpcCode = (rpcError as { code?: string }).code;
          // Fallback only when the RPC truly does not exist (missing migration/schema cache drift).
          const isMissingRpc = rpcCode === '42883'
            || rpcMessage.includes('could not find the function')
            || rpcMessage.includes('schema cache');
          if (isMissingRpc) {
            const { error: profileError } = await supabase.from('profiles').upsert({
              user_id: user.id,
              display_name: payload.p_display_name,
              full_name: payload.p_full_name,
              preferred_league: payload.p_preferred_league,
              primary_role_intent: 'fan',
              onboarding_completed_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
            if (profileError) throw new Error(profileError.message);
          } else {
            throw new Error(rpcError.message);
          }
        } else {
          const result = data as { ok: boolean; error?: string } | null;
          if (!result?.ok) {
            throw new Error(result?.error ?? 'onboarding_failed');
          }
        }

        await refresh();
        navigate(isAdmin ? '/ops' : redirectTarget);
      } else {
        // Player / coach path: existing saveOnboarding() — DO NOT CHANGE.
        await saveOnboarding({
          userId: user.id,
          displayName: form.displayName,
          fullName: form.fullName,
          primaryRoleIntent: form.primaryRoleIntent,
          preferredLeague: form.preferredLeague,
          bio: form.bio,
          avatarFile: form.avatarFile,
        });
        await refresh();

        if (form.primaryRoleIntent === 'coach') {
          setCoachSubmitted(true);
        } else if (form.primaryRoleIntent === 'player') {
          navigate('/billing?checkout=1');
        } else {
          navigate(isAdmin ? '/ops' : redirectTarget);
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <div className="panel p-6">
        <h1 className="font-display text-3xl text-primary mb-2">Welcome — let's set up your account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Fill in your details to get started. You can update them later in Settings.
        </p>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Display name <span className="text-destructive">*</span>
            </label>
            <input
              className="mt-1 w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
              placeholder="How you appear in the app"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Full name{' '}
              {isFan
                ? <span className="text-muted-foreground/60">(optional)</span>
                : <span className="text-destructive">*</span>
              }
            </label>
            <input
              className="mt-1 w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
              placeholder={isFan ? 'Your name (optional)' : 'Your legal name (for league records)'}
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              I am joining as…
            </label>
            <div className="grid gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                    form.primaryRoleIntent === opt.value
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border bg-secondary/50 hover:border-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="roleIntent"
                    value={opt.value}
                    checked={form.primaryRoleIntent === opt.value}
                    onChange={() => setForm((p) => ({ ...p, primaryRoleIntent: opt.value }))}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Preferred league
            </label>
            <select
              className="mt-1 w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
              value={form.preferredLeague}
              onChange={(e) => setForm((p) => ({ ...p, preferredLeague: e.target.value }))}
            >
              {LEAGUE_REGISTRY.map((l) => (
                <option key={l.id} value={l.code}>{l.shortName} — {l.name}</option>
              ))}
            </select>
          </div>

          {/* Bio and Avatar: MUST NOT appear for fans — player/coach only */}
          {!isFan && (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bio <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  className="mt-1 w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm min-h-20 resize-y"
                  placeholder="Tell the league a bit about yourself…"
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Profile photo <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 text-sm"
                  onChange={(e) => setForm((p) => ({ ...p, avatarFile: e.target.files?.[0] ?? null }))}
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="gold-bg px-4 py-3 rounded-sm font-display font-bold text-sm uppercase tracking-wider w-full disabled:opacity-70"
          >
            {submitting
              ? 'Saving…'
              : form.primaryRoleIntent === 'player'
              ? 'Continue to Player Registration →'
              : form.primaryRoleIntent === 'coach'
              ? 'Submit Coach Request →'
              : 'Finish Setup →'}
          </button>

          {form.primaryRoleIntent === 'player' && (
            <p className="text-xs text-muted-foreground text-center -mt-2">
              You'll be taken to checkout after saving your profile. $6.99 CAD/month + 5% GST. Cancel any time.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
