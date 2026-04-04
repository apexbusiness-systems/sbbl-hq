// OfflineBanner — renders when the browser reports navigator.onLine = false.
// Workbox caches recent schedule, team pages, and upcoming fixture data via
// StaleWhileRevalidate (5-minute TTL on /rest/v1 reads). This banner surfaces
// that cached data is being shown and live updates are paused.
//
// Placement: inside App.tsx, rendered inside <main> above route content.

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const setOnline  = () => setIsOffline(false);
    const setOffline = () => setIsOffline(true);

    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online',  setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 w-full bg-[#E63946]/90 backdrop-blur-sm border-b border-[#E63946] px-4 py-2 flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-white flex-shrink-0" aria-hidden="true" />
      <p className="text-xs font-semibold text-white tracking-wide">
        You&apos;re offline — showing last-cached scores and schedule. Live updates paused.
      </p>
    </div>
  );
}
