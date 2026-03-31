import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { signOut } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { AppRole } from '@/lib/auth/roles';
import {
  RefreshCw, Share2, CreditCard, Settings, Shield, ShoppingBag, Menu, X, LogIn, LogOut
} from 'lucide-react';

const staticNav = [
  { label: 'Home', path: '/' },
  { label: 'Live', path: '/live' },
  { label: 'Schedules', path: '/schedules' },
  { label: 'Store', path: '/store' },
  { label: 'Profiles', path: '/profiles' },
  { label: 'Support', path: '/support' },
];
// These pages accept ?league= to pre-filter — injected dynamically in the component
const leagueAwareNav = ['Stats', 'Leaderboards', 'Media'] as const;
type LeagueAwareLabel = typeof leagueAwareNav[number];
const leagueAwarePaths: Record<LeagueAwareLabel, string> = {
  Stats: '/stats',
  Leaderboards: '/leaderboards',
  Media: '/media',
};

const authRoleCycle: AppRole[] = ['fan', 'player', 'league_admin', 'super_admin'];

export const Header = () => {
  const { activeLeague, setActiveLeague, authRole, setAuthRole, isPrototypeAuthMode, isAdmin, bagItems, setBagOpen } = useApp();
  const { isSignedIn, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const handleLogoError = (id: string) => {
    setLogoErrors((prev) => ({ ...prev, [id]: true }));
  };

  const cycleAuthRole = () => {
    const currentIndex = authRoleCycle.findIndex((role) => role === authRole);
    const nextRole = authRoleCycle[(currentIndex + 1) % authRoleCycle.length];
    setAuthRole(nextRole);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">

      {/* ── TOP UTILITY BAR ───────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="container flex items-center justify-between h-10">

          {/* League switcher — left */}
          <div className="flex items-center gap-0" role="tablist" aria-label="League selector">
            {LEAGUE_REGISTRY.map((l) => {
              const isActive = activeLeague === l.id;
              return (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { setActiveLeague(l.id); navigate(`/league/${l.id}`); }}
                  className={`relative flex items-center gap-1.5 px-3 h-10 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                    isActive
                      ? `${l.accentClass} border-b-2 border-current`
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {!logoErrors[l.id] && (
                    <img
                      src={l.logo}
                      alt={l.logoAlt}
                      width={16}
                      height={16}
                      className="flex-shrink-0 opacity-80"
                      style={{ aspectRatio: '1/1' }}
                      onError={() => handleLogoError(l.id)}
                    />
                  )}
                  <span className="hidden sm:inline">{l.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Right utility controls */}
          <div className="flex items-center gap-2">
            {/* Prototype auth role toggle — always visible */}
            {isPrototypeAuthMode && (
              <button
                onClick={cycleAuthRole}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                  isAdmin
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-secondary text-secondary-foreground'
                }`}
                title="Cycle auth role (prototype)"
              >
                <Shield className="w-3 h-3" />
                {authRole.replace(/_/g, ' ')}
              </button>
            )}

            <div className="hidden md:flex items-center gap-1">
              <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Share"><Share2 className="w-3.5 h-3.5" /></button>
              {isSignedIn && <Link to="/billing" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Billing"><CreditCard className="w-3.5 h-3.5" /></Link>}
              {isSignedIn && <Link to="/settings" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Settings"><Settings className="w-3.5 h-3.5" /></Link>}
              {isAdmin && <Link to="/ops" className="p-1.5 text-primary hover:text-primary/80" aria-label="Operations"><Shield className="w-3.5 h-3.5" /></Link>}
            </div>
          </div>
        </div>
      </div>

      {/* ── PRIMARY BRAND BAR ─────────────────────────────────── */}
      <div className="container flex items-center justify-between h-12">

        {/* Wordmark */}
        <Link to="/" className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">SBBL</span>
          <span className="font-display text-lg font-bold tracking-tight text-primary">HQ</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {staticNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-sm ${
                location.pathname === item.path
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {leagueAwareNav.map((label) => {
            const base = leagueAwarePaths[label];
            const to = `${base}?league=${activeLeague}`;
            return (
              <Link
                key={base}
                to={to}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-sm ${
                  location.pathname === base
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {!isSignedIn ? (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-primary/40 text-primary rounded-sm hover:bg-primary/10 transition-colors min-h-[36px]"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in
            </Link>
          ) : (
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors min-h-[36px]"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">{user?.email?.split('@')[0] || 'Account'}</span>
            </button>
          )}

          <button
            onClick={() => setBagOpen(true)}
            className="relative p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Shopping bag"
          >
            <ShoppingBag className="w-4 h-4" />
            {bagItems.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {bagItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── MOBILE NAV DRAWER ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container py-3 flex flex-col gap-1">
            {staticNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 text-sm font-medium rounded-sm min-h-[44px] flex items-center ${
                  location.pathname === item.path ? 'text-foreground bg-secondary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {leagueAwareNav.map((label) => {
              const base = leagueAwarePaths[label];
              return (
                <Link
                  key={base}
                  to={`${base}?league=${activeLeague}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 text-sm font-medium rounded-sm min-h-[44px] flex items-center ${
                    location.pathname === base ? 'text-foreground bg-secondary' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="flex items-center gap-2 px-3 pt-2 border-t border-border mt-2">
              {isSignedIn && <Link to="/billing" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><CreditCard className="w-4 h-4" /> Billing</Link>}
              {isSignedIn && <Link to="/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Settings className="w-4 h-4" /> Settings</Link>}
              {isAdmin && <Link to="/ops" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-primary"><Shield className="w-4 h-4" /> Ops</Link>}
              {isSignedIn && (
                <button
                  onClick={() => { setMobileMenuOpen(false); void signOut(); }}
                  className="flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
