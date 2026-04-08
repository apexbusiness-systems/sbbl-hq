import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Monitor, RefreshCw, Shield, User, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/api/auth';
import { DEFAULT_CONSENT, readConsent, resetLocalMemory, type ConsentState, writeConsent } from '@/lib/consent';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Consent', icon: Shield },
  { id: 'sync', label: 'Sync Preferences', icon: RefreshCw },
  { id: 'account', label: 'Account', icon: User },
] as const;

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]['id']>('appearance');
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const { user, isGuest, exitGuestMode } = useAuth();

  useEffect(() => {
    setConsent(readConsent());
  }, []);

  const updateConsent = async (key: keyof ConsentState, enabled: boolean) => {
    const next = { ...consent, [key]: enabled };

    if (key === 'notificationsEnabled' && enabled && typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      next.notificationsEnabled = permission === 'granted';
    }

    setConsent(next);
    writeConsent(next);
  };

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12 max-w-4xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Privacy-first controls for data, voice, and account access.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <nav className="space-y-1">
            {sections.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm transition-colors ${activeSection === s.id ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </nav>

          <div className="md:col-span-3 panel p-6 space-y-4">
            {activeSection === 'appearance' && <p className="text-sm text-muted-foreground">Theme controls are available globally and remain local to this device.</p>}

            {activeSection === 'notifications' && (
              <ToggleRow title="Push notifications" description="Opt in to browser notifications. You can revoke permission in browser settings." enabled={consent.notificationsEnabled} onChange={(checked) => void updateConsent('notificationsEnabled', checked)} />
            )}

            {activeSection === 'privacy' && (
              <>
                <ToggleRow title="Local memory" description="Store app memory and reflection history on this device only." enabled={consent.localMemoryEnabled} onChange={(checked) => void updateConsent('localMemoryEnabled', checked)} />
                <ToggleRow title="Microphone" description="Allow voice capture. Raw audio is not stored by default." enabled={consent.microphoneEnabled} onChange={(checked) => void updateConsent('microphoneEnabled', checked)} />
                <ToggleRow title="Voice playback" description="Enable text-to-speech output. Disabled by default for children-oriented use." enabled={consent.voicePlaybackEnabled} onChange={(checked) => void updateConsent('voicePlaybackEnabled', checked)} />
                <ToggleRow title="Kids voice mode" description="Allow voice features for kids mode. Off by default." enabled={consent.kidsVoiceEnabled} onChange={(checked) => void updateConsent('kidsVoiceEnabled', checked)} />
                <button
                  onClick={() => {
                    resetLocalMemory();
                    setConsent(DEFAULT_CONSENT);
                  }}
                  className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-sm border border-destructive/40 text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset local memory and history
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <Link to="/privacy" className="underline text-muted-foreground hover:text-foreground">Privacy Policy</Link>
                  <Link to="/terms" className="underline text-muted-foreground hover:text-foreground">Terms of Service</Link>
                  <Link to="/acceptable-use" className="underline text-muted-foreground hover:text-foreground">Acceptable Use Policy</Link>
                  <Link to="/ai-disclaimer" className="underline text-muted-foreground hover:text-foreground">AI Guidance Disclaimer</Link>
                </div>
              </>
            )}

            {activeSection === 'sync' && (
              <ToggleRow title="Cloud sync" description="Opt-in only. Disabled by default to preserve local-first behavior." enabled={consent.cloudSyncEnabled} onChange={(checked) => void updateConsent('cloudSyncEnabled', checked)} />
            )}

            {activeSection === 'account' && (
              <>
                <p className="text-sm">Signed in as <span className="font-medium">{user?.email ?? 'Guest user'}</span>.</p>
                {isGuest ? (
                  <button onClick={exitGuestMode} className="text-xs border border-border rounded-sm px-3 py-2">Exit guest mode</button>
                ) : (
                  <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-sm">
                    <LogOut className="w-3 h-3" /> Sign Out
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ToggleRow({ title, description, enabled, onChange }: { title: string; description: string; enabled: boolean; onChange: (next: boolean) => void; }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!enabled)} aria-pressed={enabled} className={`w-11 h-6 rounded-full relative ${enabled ? 'bg-primary' : 'bg-secondary'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default SettingsPage;
