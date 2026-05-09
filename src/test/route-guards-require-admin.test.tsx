import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from '@/test/utils/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from '@/components/auth/RouteGuards';

type AuthState = {
  loading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
};

const authState: AuthState = {
  loading: false,
  isSignedIn: true,
  isAdmin: false,
  needsOnboarding: false,
};

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

describe('RequireAdmin', () => {
  beforeEach(() => {
    authState.loading = false;
    authState.isSignedIn = true;
    authState.isAdmin = false;
    authState.needsOnboarding = false;
    vi.stubEnv('VITE_E2E_BYPASS_ADMIN', 'false');
  });

  it('enforces admin access when bypass is disabled', () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE}>
        <RequireAdmin>
          <div>ops content</div>
        </RequireAdmin>
      </MemoryRouter>,
    );

    expect(screen.queryByText('ops content')).not.toBeInTheDocument();
  });

  it('allows non-admin access only when VITE_E2E_BYPASS_ADMIN is true', () => {
    vi.stubEnv('VITE_E2E_BYPASS_ADMIN', 'true');

    render(
      <MemoryRouter future={ROUTER_FUTURE}>
        <RequireAdmin>
          <div>ops content</div>
        </RequireAdmin>
      </MemoryRouter>,
    );

    expect(screen.getByText('ops content')).toBeInTheDocument();
  });

  it('allows unauthenticated access only when VITE_E2E_BYPASS_ADMIN is true', () => {
    authState.isSignedIn = false;
    vi.stubEnv('VITE_E2E_BYPASS_ADMIN', 'true');

    render(
      <MemoryRouter future={ROUTER_FUTURE}>
        <RequireAdmin>
          <div>ops content</div>
        </RequireAdmin>
      </MemoryRouter>,
    );

    expect(screen.getByText('ops content')).toBeInTheDocument();
  });
});
