import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmail } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { LEAGUE_CONFIGS } from '@/lib/leagues';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { Shield, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isSignedIn, needsOnboarding, configAvailable, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isSignedIn) navigate(needsOnboarding ? '/onboarding' : '/');
  }, [isSignedIn, needsOnboarding, navigate]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithEmail(email);
      setMessage('Magic link sent — check your inbox and click the link to sign in.');
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : 'Login failed';
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  const isEmailValid = email.includes('@') && email.includes('.');
  const canSubmit = isEmailValid && !submitting && configAvailable;

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
                <TrustBullet icon={<Shield className="w-4 h-4" />} text="Secure magic-link sign-in — no password needed" />
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

          {/* Right panel — sign in form */}
          <div className="panel p-6 md:p-8 flex flex-col justify-center">
            {/* Mobile brand header */}
            <div className="md:hidden flex items-center gap-2 mb-4">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">SBBL</span>
              <span className="font-display text-lg font-bold tracking-tight text-primary">HQ</span>
            </div>

            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">Secure Sign In</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your email to receive a one-time magic link. No password required.
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
              <button
                type="submit"
                disabled={!canSubmit}
                className="gold-bg px-4 py-3 rounded-sm font-display font-bold text-sm uppercase tracking-wider w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? 'Sending…' : 'Send Magic Link'}
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

            <div className="mt-8 pt-4 border-t border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                By signing in, you agree to our terms of service. We use secure magic links —
                your email is never shared and no password is stored.
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
