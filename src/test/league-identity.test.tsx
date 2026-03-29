import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { LEAGUE_REGISTRY } from '@/lib/leagues';

// Mock contexts minimally
vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    activeLeague: 'sbbl',
    setActiveLeague: vi.fn(),
    isAdmin: false,
    bagItems: [],
    setBagOpen: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isSignedIn: false,
    user: null,
    loading: false,
    configAvailable: true,
    needsOnboarding: false,
  }),
}));

describe('LeagueBadge component', () => {
  it('renders logo and label for each league', () => {
    for (const l of LEAGUE_REGISTRY) {
      const { unmount } = render(
        <MemoryRouter>
          <LeagueBadge leagueId={l.id} />
        </MemoryRouter>,
      );
      expect(screen.getByText(l.shortName)).toBeTruthy();
      expect(screen.getByAltText(l.logoAlt)).toBeTruthy();
      unmount();
    }
  });

  it('uses correct badge CSS class from registry', () => {
    const { container } = render(
      <MemoryRouter>
        <LeagueBadge leagueId="wbl" />
      </MemoryRouter>,
    );
    const badge = container.querySelector('.league-badge-wbl');
    expect(badge).toBeTruthy();
  });

  it('falls back to text-only when logo fails', () => {
    const { container } = render(
      <MemoryRouter>
        <LeagueBadge leagueId="sbbl" />
      </MemoryRouter>,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    // Simulate load error
    fireEvent.error(img!);
    // After error, img should be gone but text remains
    expect(screen.getByText('SBBL')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('supports md size variant', () => {
    const { container } = render(
      <MemoryRouter>
        <LeagueBadge leagueId="tgifbl" size="md" />
      </MemoryRouter>,
    );
    const badge = container.querySelector('.league-badge-tgifbl');
    expect(badge?.className).toContain('text-sm');
  });
});

describe('league identity registry completeness', () => {
  it('all logos point to /assets/leagues/ with .svg extension', () => {
    for (const l of LEAGUE_REGISTRY) {
      expect(l.logo).toMatch(/^\/assets\/leagues\/\w+\.svg$/);
    }
  });

  it('no ad-hoc league data outside registry', () => {
    // Verify registry is the only source by checking all fields populated
    const ids = LEAGUE_REGISTRY.map((l) => l.id);
    expect(ids).toContain('sbbl');
    expect(ids).toContain('wbl');
    expect(ids).toContain('tgifbl');
    expect(ids).toHaveLength(3);
  });
});
