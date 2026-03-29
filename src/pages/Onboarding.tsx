import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { saveOnboarding } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { LEAGUE_REGISTRY } from '@/lib/leagues';

const OnboardingPage = () => {
  const { user, isSignedIn, isAdmin, refresh } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    fullName: '',
    primaryRoleIntent: 'player',
    preferredLeague: 'SBBL',
    bio: '',
    avatarFile: null as File | null,
  });

  if (!isSignedIn || !user) return <Navigate to="/login" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.displayName.trim() || !form.fullName.trim()) {
      setError('Display name and full name are required.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);
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
      navigate(isAdmin ? '/ops' : '/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <div className="panel p-6">
        <h1 className="font-display text-3xl text-primary mb-4">Complete onboarding</h1>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <input className="bg-secondary border border-border rounded-sm px-3 py-2" placeholder="Display name" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} />
          <input className="bg-secondary border border-border rounded-sm px-3 py-2" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
          <select className="bg-secondary border border-border rounded-sm px-3 py-2" value={form.primaryRoleIntent} onChange={(e) => setForm((p) => ({ ...p, primaryRoleIntent: e.target.value }))}>
            <option value="player">Player</option>
            <option value="team_manager">Team manager</option>
            <option value="league_admin">League admin request</option>
            <option value="fan">Fan</option>
          </select>
          <select className="bg-secondary border border-border rounded-sm px-3 py-2 min-h-[44px]" value={form.preferredLeague} onChange={(e) => setForm((p) => ({ ...p, preferredLeague: e.target.value }))}>
            {LEAGUE_REGISTRY.map((l) => (
              <option key={l.id} value={l.code}>{l.shortName} — {l.name}</option>
            ))}
          </select>
          <textarea className="bg-secondary border border-border rounded-sm px-3 py-2 min-h-24" placeholder="Bio (optional)" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, avatarFile: e.target.files?.[0] ?? null }))} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button disabled={submitting} className="gold-bg px-4 py-2 rounded-sm font-semibold w-full md:w-auto disabled:opacity-70">{submitting ? 'Saving…' : 'Finish onboarding'}</button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
