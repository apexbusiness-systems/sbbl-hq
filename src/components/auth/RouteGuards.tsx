import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { isSignedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="container py-10 text-sm text-muted-foreground">Loading session…</div>;
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAdmin, needsOnboarding, loading, isSignedIn } = useAuth();
  const bypassAdmin = import.meta.env.VITE_E2E_BYPASS_ADMIN === 'true';

  if (loading) return <div className="container py-10 text-sm text-muted-foreground">Loading access…</div>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (!bypassAdmin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
