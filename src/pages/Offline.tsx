// Offline fallback page — served by the service worker when a navigation
// request fails (no network + no cache hit for that specific URL).
//
// The Workbox app-shell-navigations cache uses StaleWhileRevalidate with
// a 7-day TTL. This page is reached only if a specific route was never
// cached and the device is fully offline.
//
// This page is registered as workbox.offlineFallback in vite.config.ts.
// It must exist at build time so the service worker can precache it.

import { WifiOff, RefreshCw, Calendar, BarChart3, Trophy } from 'lucide-react';

const cachedPages = [
  { icon: Calendar,  label: 'Schedule',    href: '/schedules'    },
  { icon: Trophy,    label: 'Scores',      href: '/scores'       },
  { icon: BarChart3, label: 'Leaderboards', href: '/leaderboards' },
];

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Status icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[#111111] border border-[#E63946]/30 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-[#E63946]" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold uppercase tracking-widest text-[#F5F5F0]">
            You&apos;re Offline
          </h1>
          <p className="text-[#8A8A8A] text-sm leading-relaxed">
            No internet connection. Last-cached pages are still available below.
            Live scores and real-time updates will resume when you reconnect.
          </p>
        </div>

        {/* Cached page shortcuts */}
        <div className="space-y-2">
          <p className="text-[11px] text-[#8A8A8A] uppercase tracking-widest font-semibold">
            Available from cache
          </p>
          <div className="grid grid-cols-3 gap-3">
            {cachedPages.map(({ icon: Icon, label, href }) => (
              <a
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 p-4 bg-[#111111] border border-[#222222] rounded-sm hover:border-[#C9A84C]/40 hover:bg-[#111111]/80 transition-colors"
              >
                <Icon className="w-5 h-5 text-[#C9A84C]" />
                <span className="text-[11px] text-[#F5F5F0] font-semibold uppercase tracking-wider">
                  {label}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Retry */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#C9A84C] hover:bg-[#E8C76A] text-[#0A0A0A] font-display font-bold text-sm uppercase tracking-wider rounded-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        {/* Brand */}
        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-widest">
          SBBL HQ · Offline Mode
        </p>

      </div>
    </div>
  );
}
