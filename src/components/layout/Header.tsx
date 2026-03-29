import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LEAGUE_REGISTRY, getLeagueConfig } from '@/lib/leagues';
import { signOut } from '@/lib/api/auth';
import { useAuth } from '@/hooks/use-auth';
import {
  RefreshCw, Share2, CreditCard, Settings, Shield, ShoppingBag, Menu, X, LogIn, LogOut
} from 'lucide-react';

const mainNav = [
  { label: 'Home', path: '/' },
  { label: 'Teams', path: '/teams' },
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
      {/* League switcher bar */}
      <div className="border-b border-border">
        <div className="container flex items-center justify-between h-11">
          <div className="flex items-center gap-0.5" role="tablist" aria-label="League selector">
            {LEAGUE_REGISTRY.map((l) => {
              const isActive = activeLeague === l.id;
              return (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveLeague(l.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors min-h-[44px] ${
                    isActive
                      ? `${l.accentClass} border-b-2 border-current`
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {!logoErrors[l.id] && (
                    <img
                      src={l.logo}
                      alt={l.logoAlt}
                      width={20}
                      height={20}
                      className="flex-shrink-0"
                      style={{ aspectRatio: '1/1' }}
                      onError={() => handleLogoError(l.id)}
                    />
                  )}
                  <span className="hidden sm:inline">{l.shortName}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1">
              <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Share"><Share2 className="w-3.5 h-3.5" /></button>
              {isSignedIn && <Link to="/billing" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Billing"><CreditCard className="w-3.5 h-3.5" /></Link>}
              {isSignedIn && <Link to="/settings" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Settings"><Settings className="w-3.5 h-3.5" /></Link>}
              {isAdmin && <Link to="/ops" className="p-1.5 text-primary hover:text-primary/80" aria-label="Operations"><Shield className="w-3.5 h-3.5" /></Link>}
            </div>
            {!isSignedIn ? (
              <Link to="/login" className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-primary/30 text-primary rounded-sm min-h-[36px]">
                <LogIn className="w-3 h-3" /> Sign in
              </Link>
            ) : (
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-border text-muted-foreground rounded-sm min-h-[36px]">
                <LogOut className="w-3 h-3" /> <span className="hidden sm:inline">{user?.email?.split('@')[0] || 'Account'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="container flex items-center justify-between h-12">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">SBBL</span>
          <span className="font-display text-lg font-bold tracking-tight text-primary">HQ</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {mainNav.map((item) => (
            <Link key={item.path} to={item.path} className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-sm ${location.pathname === item.path ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground'}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => setBagOpen(true)} className="relative p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Shopping bag">
            <ShoppingBag className="w-4 h-4" />
            {bagItems.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{bagItems.length}</span>}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container py-3 flex flex-col gap-1">
            {mainNav.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={`px-3 py-3 text-sm font-medium rounded-sm min-h-[44px] flex items-center ${location.pathname === item.path ? 'text-foreground bg-secondary' : 'text-muted-foreground'}`}>
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
