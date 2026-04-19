import React from 'react';
import ReactPlayer from 'react-player';
import type { IPlaybackProvider } from './IPlaybackProvider';

export class ReactPlayerProvider implements IPlaybackProvider {
  name = 'ReactPlayer';

  canHandle(url: string): boolean {
    return url.includes('twitch.tv') || 
           url.includes('youtube.com') || 
           url.includes('youtu.be');
  }

  resolve(url: string) {
    return { url, type: 'react-player' };
  }

  render(config: any) {
    const { url, muted = true, autoplay = true } = config;

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
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
