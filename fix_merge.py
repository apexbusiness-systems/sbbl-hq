import sys

text = open('src/pages/Live.tsx').read()
start = text.find('<<<<<<< HEAD')
end = text.find('>>>>>>> origin/main') + len('>>>>>>> origin/main')

merged = """                <PlayerErrorBoundary key={streamNonce}>
  {(() => {
    const rawUrl = customStreamUrl || (liveGame ?? fallbackBroadcastGame)?.stream_url || "";
const playable = toPlayableUrl(rawUrl);
const playableUrl = playable.url || rawUrl;   // ← the fix
const streamType = detectStreamUrlType(playableUrl);

    if (streamType === "twitch" || streamType === "youtube") {
      return (
        <div className="relative w-full aspect-video bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#111111]">
          <ReactPlayer
            url={playableUrl}
            width="100%"
            height="100%"
            playing={true}
            controls={true}
            config={{
              youtube: { playerVars: { origin: window.location.origin } },
              twitch: { options: { parent: [window.location.hostname] } },
            }}
          />
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.5px] text-white">
            LIVE
          </div>
        </div>
      );
    }

    // All existing WHEP / HLS / native paths unchanged
    return (
      <LiveStreamPlayer
        game={(liveGame ?? fallbackBroadcastGame) as any}
        userId={user?.id ?? null}
        roles={roles}
        hasPremiumPlayerAccess={hasPremiumPlayerAccess}
        isStreamLive={isStreamLive}
      />
    );
  })()}
</PlayerErrorBoundary>"""

text = text[:start] + merged + text[end:]
open('src/pages/Live.tsx', 'w').write(text)
