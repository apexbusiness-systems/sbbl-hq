import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithMagicLink, signInWithPassword, signUpWithPassword } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { useTurnstile } from '@/hooks/use-turnstile';
import { LEAGUE_CONFIGS } from '@/lib/leagues';
import { requireSupabaseClient } from '@/lib/supabase/client';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { Shield, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';

type Mode = 'signin' | 'signup';
type SignInMethod = 'password' | 'magic-link';

const LoginPage = () => {
  const location = useLocation();
  // Support ?mode=signup (used by /register redirect) and preserve redirect param
  const urlParams = new URLSearchParams(location.search);
  const initialMode: Mode = urlParams.get('mode') === 'signup' ? 'signup' : 'signin';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { isSignedIn, isGuest, continueAsGuest, needsOnboarding, configAvailable, loading } = useAuth();
  const { containerRef: turnstileRef, resolveToken, ready: captchaReady } = useTurnstile();
  const navigate = useNavigate();

  // Redirect after login — respect ?redirect= param from /register flow.
  // Wait for loading to settle so profile/roles are known before deciding
  // between /onboarding and the target page (avoids wrong redirect flash).
  const redirectTo = urlParams.get('redirect');
  useEffect(() => {
    if ((!isSignedIn && !isGuest) || loading) return;
    if (needsOnboarding) {
      // Pass the original redirect target through onboarding so fans land on
      // /live (or their intended page) immediately after setup completes.
      const onboardingUrl = redirectTo
        ? `/onboarding?redirect=${encodeURIComponent(redirectTo)}`
        : '/onboarding';
      navigate(onboardingUrl);
    } else {
      navigate(redirectTo || '/live');
    }
  }, [isSignedIn, isGuest, loading, needsOnboarding, navigate, redirectTo]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword('');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const supabase = requireSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://sbbl-hq.icu/auth/v1/callback',
        },
      });
      if (oauthError) {
        setError('Google sign-in could not start. Please try again.');
        console.error('Google OAuth error:', oauthError.message);
      }
    } catch (oauthClientError) {
      const raw = oauthClientError instanceof Error ? oauthClientError.message : 'google_oauth_failed';
      // Surface a friendly message when the client is unavailable or initialization fails.
      setError(raw === 'supabase_client_not_configured'
        ? 'Google sign-in is temporarily unavailable. Please try again shortly.'
        : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const captchaToken = await resolveToken();
      if (mode === 'signin') {
        if (signInMethod === 'magic-link') {
          await signInWithMagicLink(email, captchaToken);
          setMessage('Magic link sent. Open your email and use the secure sign-in link.');
        } else {
          await signInWithPassword(email, password, captchaToken);
          // AuthContext onAuthStateChange will handle the SIGNED_IN event and redirect
        }
      } else {
        await signUpWithPassword(email, password, captchaToken);
        setMessage('Account created — check your inbox to confirm your email, then sign in.');
        setMode('signin');
        setPassword('');
      }
    } catch (submitError) {
      const raw = submitError instanceof Error ? submitError.message : 'Something went wrong';
      // Surface friendly messages for common Supabase and captcha error strings
      if (raw === 'captcha_loading') {
        setError('Security check is still loading. Please wait a moment and try again.');
      } else if (raw === 'captcha_timeout') {
        setError('Security check timed out. Please try again.');
      } else if (raw === 'captcha_failed') {
        setError('Security check failed. Please refresh the page and try again.');
      } else if (raw.toLowerCase().includes('invalid login') || raw.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (raw.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email address before signing in. Check your inbox.');
      } else if (raw.toLowerCase().includes('already registered') || raw.toLowerCase().includes('user already registered')) {
        setError('An account with that email already exists. Sign in instead.');
        setMode('signin');
      } else if (raw.toLowerCase().includes('password') && raw.toLowerCase().includes('characters')) {
        setError('Password must be at least 6 characters.');
      } else if (raw.toLowerCase().includes('captcha')) {
        setError('Security verification failed. Please refresh the page and try again.');
      } else {
        setError(raw);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isEmailValid = email.includes('@') && email.includes('.');
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid &&
    (mode === 'signin' ? (signInMethod === 'magic-link' || isPasswordValid) : isPasswordValid) &&
    !submitting &&
    configAvailable &&
    captchaReady;

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="grid gap-6 md:grid-cols-[1.1fr,1fr]">
          {/* Left panel — trust surface */}
          <div className="hidden md:flex flex-col justify-between panel p-8 bg-gradient-to-br from-card via-card to-[#0d0d0d]">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="font-display text-lg font-bold tracking-tight text-foreground">SBBL</span>
                <span className="font-display text-lg font-bold tracking-tight text-primary">HQ</span>
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold leading-[0.95] tracking-tight uppercase">
                Three Leagues.
                <br />
                <span className="text-primary">One Account.</span>
              </h2>
              <div className="mt-6 space-y-3">
                <TrustBullet icon={<Zap className="w-4 h-4" />} text="Live scoring and real-time game updates" />
                <TrustBullet icon={<BarChart3 className="w-4 h-4" />} text="Career stats, standings, and leaderboards" />
                <TrustBullet icon={<Users className="w-4 h-4" />} text="Team and roster operations" />
                <TrustBullet icon={<Shield className="w-4 h-4" />} text="Secure email & password — your account, your access" />
              </div>
            </div>
            <div className="mt-8">
              <div className="flex items-center gap-2">
                {LEAGUE_CONFIGS.map((l) => (
                  <LeagueBadge key={l.id} leagueId={l.id} />
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — sign in / sign up form */}
          <div className="panel p-6 md:p-8 flex flex-col justify-center">
            {/* Mobile brand header */}
            <div className="md:hidden flex items-center gap-2 mb-4">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">SBBL</span>
              <span className="font-display text-lg font-bold tracking-tight text-primary">HQ</span>
            </div>

            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'signin'
                ? 'Enter your email and password to access your account.'
                : 'Create a free account to get started.'}
            </p>

            {!configAvailable && !loading && (
              <div className="mt-4 panel p-4 border-warning/30 bg-warning/5">
                <p className="text-sm font-medium text-warning">Authentication temporarily unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Our sign-in service is being configured. Please try again shortly.
                </p>
              </div>
            )}

            {mode === 'signin' && (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignInMethod('magic-link')}
                  className={`px-3 py-2 text-xs rounded-sm border ${signInMethod === 'magic-link' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setSignInMethod('password')}
                  className={`px-3 py-2 text-xs rounded-sm border ${signInMethod === 'password' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                >
                  Password
                </button>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="login-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full bg-secondary border border-border rounded-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                  placeholder="you@example.com"
                  disabled={!configAvailable}
                />
              </div>
              {(mode === 'signup' || signInMethod === 'password') && (
                <div>
                  <label htmlFor="login-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full bg-secondary border border-border rounded-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    disabled={!configAvailable}
                    minLength={6}
                  />
                </div>
              )}
              {/* Hidden Turnstile widget mount point — rendered invisibly, executed on submit */}
              <div ref={turnstileRef} className="sr-only" aria-hidden="true" />
              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/40 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Google OAuth Pill */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!configAvailable || googleSubmitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#C9A84C]/40 transition-all duration-200 text-sm font-medium text-white"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="gold-bg px-4 py-3 rounded-sm font-display font-bold text-sm uppercase tracking-wider w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? (mode === 'signin' ? 'Submitting…' : 'Creating account…') : (mode === 'signin' ? (signInMethod === 'magic-link' ? 'Send Magic Link' : 'Sign In') : 'Create Account')}
              </button>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    continueAsGuest();
                    navigate(redirectTo || '/live');
                  }}
                  className="w-full border border-border px-4 py-2.5 rounded-sm text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground"
                >
                  Continue as Guest
                </button>
              )}
            </form>

            {location.state && (
              <p className="text-xs text-muted-foreground mt-3">Sign in to continue to a protected page.</p>
            )}

            {message && (
              <div className="mt-4 flex items-start gap-2 text-success">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{message}</p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                By signing in, you agree to our terms of service. Your email is never shared.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function TrustBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-primary/10 rounded-sm text-primary flex-shrink-0">{icon}</div>
      <span className="text-sm text-foreground/80">{text}</span>
    </div>
  );
}

export default LoginPage;
