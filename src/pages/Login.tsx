import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithPassword, signUpWithPassword } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { useTurnstile } from '@/hooks/use-turnstile';
import { LEAGUE_CONFIGS } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { Shield, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';

type Mode = 'signin' | 'signup';

const LoginPage = () => {
  const location = useLocation();
  // Support ?mode=signup (used by /register redirect) and preserve redirect param
  const urlParams = new URLSearchParams(location.search);
  const initialMode: Mode = urlParams.get('mode') === 'signup' ? 'signup' : 'signin';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isSignedIn, needsOnboarding, configAvailable, loading } = useAuth();
  const { containerRef: turnstileRef, resolveToken, ready: captchaReady } = useTurnstile();
  const navigate = useNavigate();

  // Redirect after login — respect ?redirect= param from /register flow
  const redirectTo = urlParams.get('redirect');
  useEffect(() => {
    if (isSignedIn) navigate(needsOnboarding ? '/onboarding' : (redirectTo || '/'));
  }, [isSignedIn, needsOnboarding, navigate, redirectTo]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const captchaToken = await resolveToken();
      if (mode === 'signin') {
        await signInWithPassword(email, password, captchaToken);
        // AuthContext onAuthStateChange will handle the SIGNED_IN event and redirect
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
  const canSubmit = isEmailValid && isPasswordValid && !submitting && configAvailable && captchaReady;

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

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              {/* Hidden Turnstile widget mount point — rendered invisibly, executed on submit */}
              <div ref={turnstileRef} className="sr-only" aria-hidden="true" />
              <button
                type="submit"
                disabled={!canSubmit}
                className="gold-bg px-4 py-3 rounded-sm font-display font-bold text-sm uppercase tracking-wider w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
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
