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
  fetchPipelineHealth: vi.fn(async () => ({ ok: true, overall: 'ok', metrics: {}, alerts: [], checked_at: '' })),
  mergePlayerIdentities: vi.fn(),
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

const renderOps = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OpsPage />
    </QueryClientProvider>,
  );
};

describe('ops auth gating', () => {
  beforeEach(() => {
    fetchOpsBootstrap.mockReset();
    fetchImportHistory.mockReset();

    fetchOpsBootstrap.mockResolvedValue({ ok: true, importHistory: [] });
    fetchImportHistory.mockResolvedValue({ ok: true, jobs: [] });
  });

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
    expect(shouldRetryOpsQuery(0, new Error('forbidden'))).toBe(true);
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

// ── BEHAVIORAL: regular admin (league_admin) real DOM rendering ─────────────
//
// Renders the actual OpsPage component tree with a mocked auth session — real
// React render, real conditional JSX evaluation, real DOM queries. No network
// calls (api modules are mocked above), no production data touched. This is
// what a league_admin and a super_admin actually SEE in the browser, not a
// string match against the source.
describe('regular admin (league_admin) — real rendered Ops Console', () => {
  const freshSession = (userId: string, email: string) => ({
    access_token: 'token',
    user: { id: userId, email },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  beforeEach(() => {
    fetchOpsBootstrap.mockReset();
    fetchImportHistory.mockReset();
    fetchOpsBootstrap.mockResolvedValue({ ok: true, importHistory: [] });
    fetchImportHistory.mockResolvedValue({ ok: true, jobs: [] });
  });

  it('league_admin is NOT denied entry (the old super_admin-only gate is gone)', () => {
    authState.loading = false;
    authState.session = freshSession('league-admin-1', 'statssbbl@gmail.com');
    authState.roles = ['league_admin'];

    renderOps();

    expect(screen.queryByText('Access denied. Super Admin role required.')).not.toBeInTheDocument();
    expect(screen.queryByText(/League Admin role or higher required/)).not.toBeInTheDocument();
    // Content tabs a regular admin must be able to reach are actually in the DOM.
    expect(screen.getByRole('button', { name: 'Scores' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roster Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'POTG Parser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Media Library' })).toBeInTheDocument();
  });

  it('league_admin does NOT see the Store Media tab at all (real DOM, not just disabled)', () => {
    authState.loading = false;
    authState.session = freshSession('league-admin-1', 'statssbbl@gmail.com');
    authState.roles = ['league_admin'];

    renderOps();

    expect(screen.queryByRole('button', { name: 'Store Media' })).not.toBeInTheDocument();
  });

  it('super_admin DOES see the Store Media tab', () => {
    authState.loading = false;
    authState.session = freshSession('super-admin-1', 'super@test.com');
    authState.roles = ['super_admin'];

    renderOps();

    expect(screen.getByRole('button', { name: 'Store Media' })).toBeInTheDocument();
  });

  it('a fan (below league_admin) is denied entry with the new copy', () => {
    authState.loading = false;
    authState.session = freshSession('fan-1', 'fan@test.com');
    authState.roles = ['fan'];

    renderOps();

    expect(screen.getByText('Access denied. League Admin role or higher required.')).toBeInTheDocument();
    // None of the content tabs render behind the denial.
    expect(screen.queryByRole('button', { name: 'Scores' })).not.toBeInTheDocument();
  });

  it('a team_manager (below league_admin) is denied entry', () => {
    authState.loading = false;
    authState.session = freshSession('tm-1', 'tm@test.com');
    authState.roles = ['team_manager'];

    renderOps();

    expect(screen.getByText('Access denied. League Admin role or higher required.')).toBeInTheDocument();
  });
});
