import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    roles: [],
    isAdmin: false,
    isSignedIn: false,
    needsOnboarding: false,
    configAvailable: true,
    loading: false,
  }),
}));

vi.mock('@/hooks/use-turnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null },
    resolveToken: vi.fn(async () => 'turnstile-stub'),
    ready: true,
  }),
}));

let runtimeConfigValue: { googleOAuthEnabled: boolean } = { googleOAuthEnabled: false };

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(async () => ({
    supabaseUrl: 'https://x.supabase.co',
    supabasePublishableKey: 'k',
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
    ...runtimeConfigValue,
  })),
  getRuntimeConfigSync: vi.fn(() => ({
    supabaseUrl: 'https://x.supabase.co',
    supabasePublishableKey: 'k',
    appName: 'SBBL HQ',
    defaultLeague: 'SBBL',
    ...runtimeConfigValue,
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  requireSupabaseClient: () => ({
    auth: { signInWithOAuth: vi.fn() },
  }),
}));

vi.mock('@/lib/api/auth', () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

import LoginPage from '@/pages/Login';

describe('Login — Google OAuth capability flag', () => {
  beforeEach(() => {
    runtimeConfigValue = { googleOAuthEnabled: false };
  });

  it('hides the Google sign-in button and shows an unavailable note when the flag is false', async () => {
    runtimeConfigValue = { googleOAuthEnabled: false };
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('google-signin-button')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('google-signin-unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Google sign-in is temporarily unavailable/i)).toBeInTheDocument();

    // Email/password path must still be intact.
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the Google sign-in button when the flag is true', async () => {
    runtimeConfigValue = { googleOAuthEnabled: true };
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('google-signin-button')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('google-signin-unavailable')).not.toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();

    // Email/password still rendered too.
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('preserves the org_internal error message in the URL search params', async () => {
    runtimeConfigValue = { googleOAuthEnabled: true };

    // Simulate Supabase bouncing us back with an org_internal error.
    window.history.pushState(
      {},
      'login',
      '/login?error=invalid_request&error_description=org_internal%20app',
    );

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/this OAuth app is set to Internal-only/i)).toBeInTheDocument();
    });

    // Cleanup
    window.history.pushState({}, 'login', '/login');
  });
});
