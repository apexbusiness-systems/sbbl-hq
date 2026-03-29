import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmail } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
    <div className="container max-w-md py-10">
      <div className="panel p-6 space-y-4">
        <h1 className="font-display text-3xl text-primary">Login</h1>
        <p className="text-sm text-muted-foreground">Use your email to receive a secure sign-in link.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-secondary border border-border rounded-sm px-3 py-2"
            placeholder="you@sbblhq.com"
          />
          <button disabled={submitting} className="gold-bg px-4 py-2 rounded-sm font-semibold w-full disabled:opacity-70">
            {submitting ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
        {location.state && <p className="text-xs text-muted-foreground">Sign in to continue to a protected page.</p>}
        {message && <p className="text-xs text-success">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
};

export default LoginPage;
