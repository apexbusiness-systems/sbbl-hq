import fs from 'fs';

const path = 'src/lib/playback/ReactPlayerProvider.tsx';
let content = `import React from 'react';
import ReactPlayer from 'react-player';

export class ReactPlayerProvider {
  canHandle(url: string): boolean {
    return url.includes('twitch.tv') ||
            url.includes('youtube.com') ||
            url.includes('youtu.be');
  }

  render(config: { url: string, muted?: boolean, autoplay?: boolean }) {
    const { url, muted = true, autoplay = true } = config;
    return (
      <div className="relative w-full aspect-video bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#111111]">
        <ReactPlayer
          url={url}
          width="100%"
          height="100%"
          playing={autoplay}
          muted={muted}
          controls={true}
          config={{
            youtube: {
              playerVars: {
                modestbranding: 1,
                rel: 0,
              },
            },
            twitch: {
              options: {
                // MANDATORY: Without this, Twitch will block the embed in production
                parent: ["sbbl-hq.icu", "localhost"],
                muted: muted,
                autoplay: autoplay,
              },
            },
          }}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      </div>
    );
  }
}
`
fs.writeFileSync(path, content, 'utf8');
