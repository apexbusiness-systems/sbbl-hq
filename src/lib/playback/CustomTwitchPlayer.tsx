import React, { Component } from 'react';
import { toPlayableUrl } from '@/lib/stream/url-detector';

const SDK_URL = 'https://player.twitch.tv/js/embed/v1.js';
const SDK_GLOBAL = 'Twitch';

const MATCH_URL_TWITCH_CHANNEL = /(?:www\.|go\.)?twitch\.tv\/([a-zA-Z0-9_]+)($|\?)/;
const MATCH_URL_TWITCH_VIDEO = /(?:www\.|go\.)?twitch\.tv\/videos\/([0-9]+)($|\?)/;

function loadScript(url: string, globalName: string): Promise<any> {
  if ((window as any)[globalName]) return Promise.resolve((window as any)[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve((window as any)[globalName]);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export class CustomTwitchPlayer extends Component<any> {
  static displayName = 'CustomTwitchPlayer';
  static canPlay = (url: string) => MATCH_URL_TWITCH_CHANNEL.test(url) || MATCH_URL_TWITCH_VIDEO.test(url);
  static loopOnEnded = true;

  player: any = null;
  playerID = `twitch-player-${Math.random().toString(36).substring(2, 7)}`;

  componentDidMount() {
    if (this.props.onMount) {
      this.props.onMount(this);
    }
  }

  load(url: string, isReady: boolean) {
    const { playsinline, onError, config, controls, playing, muted } = this.props;
    const isChannel = MATCH_URL_TWITCH_CHANNEL.test(url);
    const idMatch = isChannel ? url.match(MATCH_URL_TWITCH_CHANNEL) : url.match(MATCH_URL_TWITCH_VIDEO);
    const id = idMatch ? idMatch[1] : '';

    if (isReady && this.player) {
      if (isChannel) {
        this.player.setChannel(id);
      } else {
        this.player.setVideo('v' + id);
      }
      return;
    }

    loadScript(SDK_URL, SDK_GLOBAL).then((Twitch) => {
      // Build options carefully, omitting the `video` key entirely if it's a channel.
      const options: any = {
        width: '100%',
        height: '100%',
        playsinline,
        autoplay: playing, // Pass explicitly
        muted: muted,      // Pass explicitly
        controls: isChannel ? true : controls,
        ...config.twitch?.options,
      };

      // Set only the relevant ID key
      if (isChannel) {
        options.channel = id;
        delete options.video;
      } else {
        options.video = id;
        delete options.channel;
      }

      this.player = new Twitch.Player(this.playerID, options);

      const { READY, PLAYING, PAUSE, ENDED, ONLINE, OFFLINE, SEEK } = Twitch.Player;
      this.player.addEventListener(READY, this.props.onReady);
      this.player.addEventListener(PLAYING, this.props.onPlay);
      this.player.addEventListener(PAUSE, this.props.onPause);
      this.player.addEventListener(ENDED, this.props.onEnded);
      this.player.addEventListener(SEEK, this.props.onSeek);
      this.player.addEventListener(ONLINE, this.props.onLoaded);
      this.player.addEventListener(OFFLINE, this.props.onLoaded);
    }).catch(onError);
  }

  play() { if (this.player) this.player.play(); }
  pause() { if (this.player) this.player.pause(); }
  stop() { if (this.player) this.player.pause(); }
  seekTo(seconds: number, keepPlaying = true) {
    if (this.player) {
      this.player.seek(seconds);
      if (!keepPlaying) this.pause();
    }
  }
  setVolume(fraction: number) { if (this.player) this.player.setVolume(fraction); }
  getDuration() { return this.player ? this.player.getDuration() : 0; }
  getCurrentTime() { return this.player ? this.player.getCurrentTime() : 0; }
  getSecondsLoaded() { return null; }
  setMuted(muted: boolean) { if (this.player) this.player.setMuted(muted); }

  render() {
    return <div style={{ width: '100%', height: '100%' }} id={this.playerID} />;
  }
}
