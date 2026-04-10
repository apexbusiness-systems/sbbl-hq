import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OpsPage, { assertOpsAccess, isSessionFresh, shouldRetryOpsQuery } from '@/pages/Ops';

type MockAuthState = {
  loading: boolean;
  session: { access_token: string; user: { id: string; email: string }; expires_at?: number } | null;
  user: { id: string; email: string } | null;
  roles: string[];
};

const {
  fetchOpsBootstrap,
  fetchImportHistory,
  authState,
} = vi.hoisted(() => ({
  fetchOpsBootstrap: vi.fn(),
  fetchImportHistory: vi.fn(),
  authState: {
    loading: false,
    session: { access_token: 'token', user: { id: 'u1', email: 'admin@test.com' } },
    user: { id: 'u1', email: 'admin@test.com' },
    roles: ['super_admin'],
  } as MockAuthState,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/api/ops', () => ({
  fetchOpsBootstrap,
  fetchImportHistory,
  submitCsvImport: vi.fn(),
  parseEventImage: vi.fn(),
  parsePotgImage: vi.fn(),
  manualOpsAction: vi.fn(),
  ingestPresign: vi.fn(),
  ingestSubmit: vi.fn(),
  ingestApprove: vi.fn(),
  ingestReject: vi.fn(),
}));

vi.mock('@/lib/api/scores', () => ({
  fetchScores: vi.fn(async () => ({ ok: true, games: [] })),
  submitScoreManual: vi.fn(),
  submitScoresCsvImport: vi.fn(),
  parseScoreboardImage: vi.fn(),
}));

vi.mock('@/lib/imageResize', () => ({
  inferTargetDimensions: vi.fn(async () => ({ width: 100, height: 100, mode: 'cover' })),
  resizeImageToFit: vi.fn(async (file: File) => file),
}));

describe('ops auth gating', () => {
  beforeEach(() => {
    fetchOpsBootstrap.mockReset();
    fetchImportHistory.mockReset();

    fetchOpsBootstrap.mockResolvedValue({ ok: true, importHistory: [] });
    fetchImportHistory.mockResolvedValue({ ok: true, jobs: [] });
  });

  const renderOps = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <OpsPage />
      </QueryClientProvider>,
    );
  };

  it('keeps ops queries disabled until auth is ready', async () => {
    authState.loading = true;
    authState.session = null;
    authState.roles = [];

    renderOps();

    expect(screen.getByText('Loading Ops session…')).toBeInTheDocument();
    expect(fetchOpsBootstrap).not.toHaveBeenCalled();
    expect(fetchImportHistory).not.toHaveBeenCalled();
  });

  it('does not retry auth boundary errors', () => {
    expect(shouldRetryOpsQuery(0, new Error('unauthorized'))).toBe(false);
    expect(shouldRetryOpsQuery(0, new Error('forbidden'))).toBe(false);
    expect(shouldRetryOpsQuery(0, new Error('reauth_required'))).toBe(false);
    expect(shouldRetryOpsQuery(0, new Error('network_error'))).toBe(true);
  });

  it('allows guarded upload path when canRunOps is true', () => {
    expect(() => assertOpsAccess(true)).not.toThrow();
  });

  it('treats expired auth sessions as invalid for ops access', () => {
    expect(isSessionFresh({ expires_at: 1 }, 2_000)).toBe(false);
    expect(isSessionFresh({ expires_at: 3 }, 2_000)).toBe(true);
  });

  it('invalid session shows reauth state and blocks ops actions', () => {
    authState.loading = false;
    authState.session = null;
    authState.roles = ['super_admin'];

    renderOps();

    expect(screen.getByText('Session expired. Sign in again.')).toBeInTheDocument();
    expect(fetchOpsBootstrap).not.toHaveBeenCalled();
  });

  it('expired session shows reauth state and blocks ops actions', () => {
    authState.loading = false;
    authState.session = {
      access_token: 'token',
      user: { id: 'u1', email: 'admin@test.com' },
      expires_at: 1,
    };
    authState.roles = ['super_admin'];

    renderOps();

    expect(screen.getByText('Session expired. Sign in again.')).toBeInTheDocument();
    expect(fetchOpsBootstrap).not.toHaveBeenCalled();
  });
});
