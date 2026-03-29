import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmail } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { hasSupabaseClientConfig } from '@/lib/supabase/client';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const { isSignedIn, needsOnboarding } = useAuth();
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
      setMessage('Magic link sent. Check your inbox and return here after opening the link.');
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : 'Login failed';
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-5xl py-10">
      <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
        <div className="panel relative overflow-hidden min-h-[320px] hidden md:block">
          {!heroImageFailed && (
            <img
              src="/hero-basketball.svg"
              alt="SBBL courtside hero"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
              // Hide image layer if it cannot be served by host/CDN.
              onError={() => setHeroImageFailed(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
          <div className="relative p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">SBBL HQ</p>
            <h2 className="font-display text-4xl text-foreground leading-[0.95]">
              Three Leagues.
              <br />
              One Platform.
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Sign in to manage operations, imports, and league data with live production workflows.
            </p>
          </div>
        </div>
        <div className="panel p-6 space-y-4">
          <h1 className="font-display text-3xl text-primary">Login</h1>
          <p className="text-sm text-muted-foreground">Use your email to receive a secure sign-in link.</p>
          {!hasSupabaseClientConfig && (
            <p className="text-xs text-warning">
              Supabase env missing. Configure <code>VITE_SUPABASE_URL</code> and either <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> or <code>VITE_SUPABASE_ANON_KEY</code>.
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-secondary border border-border rounded-sm px-3 py-2"
              placeholder="you@sbblhq.com"
            />
            <button disabled={submitting || !hasSupabaseClientConfig} className="gold-bg px-4 py-2 rounded-sm font-semibold w-full disabled:opacity-70">
              {submitting ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
          {location.state && <p className="text-xs text-muted-foreground">Sign in to continue to a protected page.</p>}
          {message && <p className="text-xs text-success">{message}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
