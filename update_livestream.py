import re

with open('src/components/LiveStreamPlayer.tsx', 'r') as f:
    content = f.read()

# I need to add imports to the top:
# import { useState, useEffect } from 'react';
# import { Link } from 'react-router-dom';
# import { Lock, Play, Ticket, Copy, Check, KeyRound, ExternalLink, Settings, Video, Mic, MicOff, RefreshCw } from 'lucide-react';
# Add the missing icons to the import from lucide-react

import_pattern = r"import { Lock, Play, Ticket, Copy, Check, KeyRound } from 'lucide-react';"
new_import = "import { Lock, Play, Ticket, Copy, Check, KeyRound, ExternalLink, Settings, Video, Mic, MicOff, RefreshCw } from 'lucide-react';"
content = content.replace(import_pattern, new_import)

# We need to add the new superadmin panel component. I'll define it right before LiveStreamPlayer
panel_component = """
function SuperAdminPanel() {
  const [isLive, setIsLive] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [source, setSource] = useState('main');
  const [title, setTitle] = useState('Live Game Broadcast');
  const [viewerCount, setViewerCount] = useState(1204);
  const [isMuted, setIsMuted] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Fake viewer count incrementing
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 5) - 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <>
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-3 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-4 rounded-xl shadow-2xl w-80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Super Admin</span>
          {isLive ? (
            <div className="flex items-center gap-2 text-green-500 font-bold text-xs uppercase tracking-widest animate-pulse">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Offline
            </div>
          )}
        </div>

        {/* GO LIVE Toggle */}
        <button
          onClick={() => setShowConfirm(true)}
          className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
            isLive
              ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20'
              : 'bg-green-500 text-black hover:bg-green-400'
          }`}
        >
          {isLive ? 'End Broadcast' : 'Go Live'}
        </button>

        <div className="space-y-3 mt-2">
          {/* Source Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-600"
            >
              <option value="main">Main Feed</option>
              <option value="backup">Backup Feed</option>
              <option value="test">Test Loop</option>
            </select>
          </div>

          {/* Stream Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Stream Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Viewer Count & Mute */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Viewers</span>
              <span className="font-mono text-sm">{isLive ? viewerCount.toLocaleString() : '0'}</span>
            </div>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-md transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Link */}
          <button
            onClick={() => window.open('https://studio.switcherstudio.com', '_blank')}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs text-zinc-400 hover:text-white bg-zinc-900 rounded-md transition-colors border border-transparent hover:border-zinc-700"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Switcher Studio
          </button>

          {/* Toggle Offline Overlay */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
          >
            Toggle Offline Overlay
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl max-w-sm w-full mx-4">
            <h3 className="font-display font-bold text-lg mb-2">{isLive ? 'End Broadcast?' : 'Go Live?'}</h3>
            <p className="text-zinc-400 text-sm mb-6">
              {isLive
                ? 'Are you sure you want to end the broadcast? Viewers will see the offline screen.'
                : 'This will push the stream live to all current viewers. Make sure your Switcher Studio is ready.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsLive(!isLive);
                  setShowConfirm(false);
                  if (isLive) setIsOfflineMode(true);
                  if (!isLive) setIsOfflineMode(false);
                }}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  isLive ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-black hover:bg-green-400'
                }`}
              >
                {isLive ? 'End Stream' : 'Confirm Go Live'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graceful Offline Overlay */}
      {isOfflineMode && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
          <Video className="w-12 h-12 text-zinc-700 mb-4" />
          <h2 className="text-xl font-bold font-display uppercase tracking-wider text-zinc-300 mb-2">Stream Offline</h2>
          <p className="text-sm text-zinc-500 mb-6">We'll be right back. Hang tight.</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700"
          >
            <RefreshCw className="w-4 h-4" /> Retry Connection
          </button>
        </div>
      )}
    </>
  );
}

"""

if "function SuperAdminPanel" not in content:
    content = content.replace("export function LiveStreamPlayer({", panel_component + "export function LiveStreamPlayer({")

# We need to detect super admin
# Inside LiveStreamPlayer, before `if (hasAccess)`
super_admin_check = """
  // ── Super Admin Check ────────────────────────────────────────────────────
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);
  useEffect(() => {
    const isLocalSuperAdmin = localStorage.getItem('role') === 'superadmin';
    const isUrlAdmin = window.location.search.includes('admin=true');
    if (isLocalSuperAdmin || isUrlAdmin || isSuperAdmin) {
      setIsSuperAdminView(true);
    }
  }, [isSuperAdmin]);
"""

if "const [isSuperAdminView" not in content:
    content = content.replace("  // ── Gate 2: Access granted", super_admin_check + "\n  // ── Gate 2: Access granted")

# Now, we replace the iframe with the Switcher Studio embed
iframe_pattern = r"""        \{\/\*
          Switcher Studio embed\.
          REPLACE src with real embed URL before April 2:
            e\.g\. https:\/\/stream\.switcherstudio\.com\/live\/<channel-id>
        \*\/\}
        <iframe
          src={`https:\/\/switcherstudio\.com\/embed\/\$\{game\.id\}`}
          className="w-full h-full border-0"
          allow="camera; microphone; fullscreen; display-capture"
          referrerPolicy="no-referrer-when-downgrade"
          title={`\$\{game\.homeTeam\.name\} vs \$\{game\.awayTeam\.name\} — Live`}
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        \/>"""

switcher_embed = """        {/* Switcher Studio Player Embed */}
        <script src="https://player.switcherstudio.com/embed.js" async />
        {/* TODO: Replace YOUR_COLLECTION_ID_HERE with the real COLLECTION_ID */}
        <div
          data-switcher-collection="YOUR_COLLECTION_ID_HERE"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Super Admin Control Panel */}
        {isSuperAdminView && <SuperAdminPanel />}"""

content = re.sub(iframe_pattern, switcher_embed, content)

with open('src/components/LiveStreamPlayer.tsx', 'w') as f:
    f.write(content)
