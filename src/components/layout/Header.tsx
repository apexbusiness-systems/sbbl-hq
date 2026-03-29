import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { signOut } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import {
  RefreshCw, Share2, CreditCard, Settings, Shield, ShoppingBag, Menu, X, LogIn, LogOut
} from 'lucide-react';

const mainNav = [
  { label: 'Home', path: '/' },
  { label: 'Teams', path: '/teams' },
  { label: 'Schedules', path: '/schedules' },
];

export const Header = () => {
  const { activeLeague, setActiveLeague, isAdmin, bagItems, setBagOpen } = useApp();
  const { isSignedIn, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const handleLogoError = (id: string) => {
    setLogoErrors((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">

      {/* ── PRIMARY BRAND BAR ─────────────────────────────────── */}
      <div className="container flex items-center justify-between h-14">

        {/* Wordmark — dominant, always left */}
        <Link to="/" className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-display text-2xl font-bold tracking-widest uppercase text-foreground leading-none">SBBL</span>
          <span className="font-display text-2xl font-bold tracking-widest uppercase text-primary leading-none">HQ</span>
        </Link>

        {/* Main nav — center on desktop */}
        <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {mainNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-1.5 text-sm font-semibold uppercase tracking-wider transition-colors rounded-sm ${
                location.pathname === item.path
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Share"><Share2 className="w-3.5 h-3.5" /></button>
            {isSignedIn && <Link to="/billing" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Billing"><CreditCard className="w-3.5 h-3.5" /></Link>}
            {isSignedIn && <Link to="/settings" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Settings"><Settings className="w-3.5 h-3.5" /></Link>}
            {isAdmin && <Link to="/ops" className="p-1.5 text-primary hover:text-primary/80" aria-label="Operations"><Shield className="w-3.5 h-3.5" /></Link>}
          </div>

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

      {/* ── LEAGUE SWITCHER SUB-BAR ───────────────────────────── */}
      <div className="border-t border-border/50">
        <div className="container flex items-center justify-between h-10">
          <div className="flex items-center gap-0" role="tablist" aria-label="League selector">
            {LEAGUE_REGISTRY.map((l) => {
              const isActive = activeLeague === l.id;
              return (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveLeague(l.id)}
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

          {/* Subtle league context label */}
          <span className="hidden md:block text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 font-medium">
            Select League
          </span>
        </div>
      </div>

      {/* ── MOBILE NAV DRAWER ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container py-3 flex flex-col gap-1">
            {mainNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-3 text-sm font-semibold uppercase tracking-wider rounded-sm min-h-[44px] flex items-center ${
                  location.pathname === item.path ? 'text-foreground bg-secondary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isSignedIn && (
              <div className="flex flex-col gap-1 px-0 pt-2 border-t border-border mt-2">
                <Link to="/billing" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground min-h-[44px]"><CreditCard className="w-4 h-4" /> Billing</Link>
                <Link to="/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground min-h-[44px]"><Settings className="w-4 h-4" /> Settings</Link>
                {isAdmin && <Link to="/ops" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-3 text-sm text-primary min-h-[44px]"><Shield className="w-4 h-4" /> Ops</Link>}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
