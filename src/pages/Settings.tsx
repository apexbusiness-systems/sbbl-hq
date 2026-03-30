import { useState } from 'react';
import { Monitor, Bell, Smartphone, Link, Shield, RefreshCw, User, LogOut } from 'lucide-react';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/api/auth';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'linked', label: 'Linked Destinations', icon: Link },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'sync', label: 'Sync Preferences', icon: RefreshCw },
  { id: 'account', label: 'Account', icon: User },
];

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('appearance');
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Preferences and account management</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <nav className="space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm transition-colors ${activeSection === s.id ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="md:col-span-3 panel p-6 space-y-6">
            {activeSection === 'appearance' && (
              <>
                <h3 className="font-display font-bold">Appearance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Choose your preferred theme</p></div>
                    <div className="flex gap-1 p-0.5 bg-secondary rounded-sm">
                      <button className="px-3 py-1 text-xs bg-card rounded-sm font-medium">Dark</button>
                      <button className="px-3 py-1 text-xs text-muted-foreground rounded-sm">Light</button>
                      <button className="px-3 py-1 text-xs text-muted-foreground rounded-sm">System</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div><p className="text-sm font-medium">Compact Mode</p><p className="text-xs text-muted-foreground">Reduce spacing for more content density</p></div>
                    <div className="w-10 h-5 bg-secondary rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-4 h-4 bg-muted-foreground rounded-full transition-transform" /></div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div><p className="text-sm font-medium">Default League</p><p className="text-xs text-muted-foreground">Set your default league view</p></div>
                    <select className="bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs min-h-[36px]">
                      {LEAGUE_REGISTRY.map((l) => (
                        <option key={l.id} value={l.code}>{l.shortName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            {activeSection === 'notifications' && (
              <>
                <h3 className="font-display font-bold">Notifications</h3>
                <div className="space-y-4">
                  {['Game Start Alerts', 'Score Updates', 'Store Drops', 'Reward Milestones', 'Schedule Changes'].map(n => (
                    <div key={n} className="flex items-center justify-between py-3 border-b border-border">
                      <p className="text-sm font-medium">{n}</p>
                      <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary-foreground rounded-full" /></div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeSection === 'privacy' && (
              <>
                <h3 className="font-display font-bold">Privacy & Consent</h3>
                <div className="space-y-4">
                  {['Profile Visibility', 'Stat Sharing', 'Activity Status', 'Data Collection Consent', 'Marketing Communications'].map(n => (
                    <div key={n} className="flex items-center justify-between py-3 border-b border-border">
                      <p className="text-sm font-medium">{n}</p>
                      <div className="w-10 h-5 bg-secondary rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-4 h-4 bg-muted-foreground rounded-full" /></div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeSection === 'account' && (
              <>
                <h3 className="font-display font-bold">Account</h3>
                <div className="space-y-4">
                  <div className="py-3 border-b border-border">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{user?.email ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Sign-in uses a magic link sent to this address. No password required.</p>
                  </div>
                  <div className="py-3 border-b border-border">
                    <p className="text-sm font-medium">Sign Out</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Sign out of your account on this device.</p>
                    <button
                      onClick={() => void signOut()}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors"
                    >
                      <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                  </div>
                  <div className="py-3">
                    <p className="text-sm font-medium text-destructive/80">Danger Zone</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Contact support to delete your account and all associated data.</p>
                  </div>
                </div>
              </>
            )}
            {!['appearance', 'notifications', 'privacy', 'account'].includes(activeSection) && (
              <>
                <h3 className="font-display font-bold">{sections.find(s => s.id === activeSection)?.label}</h3>
                <p className="text-sm text-muted-foreground">This section will be configured with your connected services.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
