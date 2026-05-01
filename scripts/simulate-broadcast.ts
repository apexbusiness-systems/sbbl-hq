/**
 * Deterministic simulation of the full link-ingest → broadcast pipeline.
 *
 * Run via: npm run simulate:broadcast
 *
 * For each representative stream URL we walk:
 *   1. canonicalizeStreamSourceUrl  — admin save-time validation
 *   2. detectStreamUrlType          — provider classification
 *   3. toPlayableUrl                — URL transform for the player
 *   4. getStreamDeliveryClass       — embed | proxy | hls | unsupported
 *   5. getStreamTypeAdvisory        — admin-facing message
 *   6. StreamPlayer outcome         — what the viewer ultimately sees
 *
 * The final column ("viewer outcome") mirrors the branch order in
 * StreamPlayer (src/components/LiveStreamPlayer.tsx):
 *
 *   isRtmp        → advisory:rtmp
 *   isFacebook    → advisory:facebook
 *   isUnembeddable→ advisory:unembeddable  (kick / instagram / x-spaces)
 *   isWhep        → WhepPlayer
 *   else          → ReactPlayer (lazy)
 *
 * The script is the canonical baseline reference for live-stream URL
 * handling. Onboarding agents and devs MUST run it after any change that
 * touches:
 *
 *   - src/lib/stream/url-detector.ts
 *   - src/components/LiveStreamPlayer.tsx (StreamPlayer branches)
 *   - the worker stream-resolution pipeline
 *
 * Exits non-zero on any scenario mismatch so it can be wired into CI.
 */
import {
  canonicalizeStreamSourceUrl,
  detectStreamUrlType,
  getStreamDeliveryClass,
  getStreamTypeAdvisory,
  toPlayableUrl,
  type StreamUrlType,
} from '../src/lib/stream/url-detector';

interface Scenario {
  label: string;
  url: string;
  expect: {
    type: StreamUrlType;
    canonicalize: 'accept' | 'reject';
    viewer:
      | 'reactplayer'
      | 'whep'
      | 'advisory:rtmp'
      | 'advisory:facebook'
      | 'advisory:unembeddable';
  };
}

const SCENARIOS: Scenario[] = [
  {
    label: 'HLS (live.m3u8)',
    url: 'https://stream.sbbl-hq.icu/live/master.m3u8',
    expect: { type: 'hls', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'HLS (signed CDN)',
    url: 'https://cdn.example.com/play.m3u8?token=abc&exp=1',
    expect: { type: 'hls', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'DASH (.mpd)',
    url: 'https://cdn.example.com/manifest.mpd',
    expect: { type: 'dash', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'MP4 (direct file)',
    url: 'https://cdn.example.com/highlights/q4.mp4',
    expect: { type: 'mp4', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'YouTube live',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expect: { type: 'youtube', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'YouTube /embed/ (canonicalized)',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    expect: { type: 'youtube', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'Twitch channel',
    url: 'https://www.twitch.tv/sbblofficial',
    expect: { type: 'twitch', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'Twitch player.twitch.tv (legacy)',
    url: 'https://player.twitch.tv/?channel=sbblofficial&parent=sbbl-hq.icu',
    expect: { type: 'twitch', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'Vimeo',
    url: 'https://vimeo.com/123456789',
    expect: { type: 'vimeo', canonicalize: 'accept', viewer: 'reactplayer' },
  },
  {
    label: 'WHEP (low-latency WebRTC)',
    url: 'https://stream.sbbl-hq.icu/whep/live',
    expect: { type: 'whep', canonicalize: 'accept', viewer: 'whep' },
  },
  {
    label: 'RTMP (browser-incompatible)',
    url: 'rtmp://ingest.example.com/live/streamkey',
    expect: { type: 'rtmp', canonicalize: 'accept', viewer: 'advisory:rtmp' },
  },
  {
    label: 'Facebook page (real-world bug case)',
    url: 'https://www.facebook.com/boxontrack2019',
    expect: {
      type: 'facebook',
      canonicalize: 'accept',
      viewer: 'advisory:facebook',
    },
  },
  {
    label: 'fb.watch short link',
    url: 'https://fb.watch/abc123',
    expect: {
      type: 'facebook',
      canonicalize: 'accept',
      viewer: 'advisory:facebook',
    },
  },
  {
    label: 'Facebook plugin embed (rejected at save)',
    url: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fvideo%2Fxyz',
    expect: {
      type: 'facebook',
      canonicalize: 'reject',
      viewer: 'advisory:facebook',
    },
  },
  {
    label: 'Kick',
    url: 'https://kick.com/sbbl',
    expect: {
      type: 'kick',
      canonicalize: 'accept',
      viewer: 'advisory:unembeddable',
    },
  },
  {
    label: 'Instagram Live',
    url: 'https://www.instagram.com/sbbl/live/',
    expect: {
      type: 'instagram',
      canonicalize: 'accept',
      viewer: 'advisory:unembeddable',
    },
  },
  {
    label: 'X Spaces',
    url: 'https://x.com/i/spaces/1MnGnpZNWyzJO',
    expect: {
      type: 'x-spaces',
      canonicalize: 'accept',
      viewer: 'advisory:unembeddable',
    },
  },
  {
    label: 'Empty string (rejected)',
    url: '',
    expect: { type: 'unknown', canonicalize: 'reject', viewer: 'reactplayer' },
  },
  {
    label: 'Garbage (rejected)',
    url: 'not a url',
    expect: { type: 'unknown', canonicalize: 'reject', viewer: 'reactplayer' },
  },
];

function classifyViewerOutcome(type: StreamUrlType): Scenario['expect']['viewer'] {
  if (type === 'rtmp') return 'advisory:rtmp';
  if (type === 'facebook') return 'advisory:facebook';
  if (type === 'kick' || type === 'instagram' || type === 'x-spaces') {
    return 'advisory:unembeddable';
  }
  if (type === 'whep') return 'whep';
  return 'reactplayer';
}

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

console.log('SBBL HQ — link-ingest → broadcast pipeline simulation');
console.log('═'.repeat(120));
console.log(
  pad('Scenario', 36) +
    pad('Type', 11) +
    pad('Canon', 8) +
    pad('Delivery', 12) +
    pad('Viewer outcome', 22) +
    'Status',
);
console.log('─'.repeat(120));

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const s of SCENARIOS) {
  const canonResult = canonicalizeStreamSourceUrl(s.url);
  const detected = detectStreamUrlType(s.url);
  const playable = toPlayableUrl(s.url);
  const delivery = getStreamDeliveryClass(s.url);
  const advisory = getStreamTypeAdvisory(detected);
  const viewer = classifyViewerOutcome(detected);

  const canonStatus: 'accept' | 'reject' = canonResult.ok ? 'accept' : 'reject';
  const ok =
    detected === s.expect.type &&
    canonStatus === s.expect.canonicalize &&
    viewer === s.expect.viewer;

  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(
      `  ${s.label} — got type=${detected}/canon=${canonStatus}/viewer=${viewer}, expected type=${s.expect.type}/canon=${s.expect.canonicalize}/viewer=${s.expect.viewer}`,
    );
  }

  console.log(
    pad(s.label, 36) +
      pad(detected, 11) +
      pad(canonStatus, 8) +
      pad(delivery, 12) +
      pad(viewer, 22) +
      (ok ? '✓' : '✗'),
  );

  const truncatedPlayable =
    playable.url.length > 80 ? playable.url.slice(0, 77) + '...' : playable.url;
  const advisoryText = advisory.message ? `[${advisory.level}] ${advisory.message}` : '';
  if (advisoryText) console.log('    ↳ advisory: ' + advisoryText);
  if (playable.url && playable.url !== s.url) {
    console.log('    ↳ transformed URL: ' + truncatedPlayable);
  }
  if (playable.warning) {
    console.log('    ↳ playback warning: ' + playable.warning);
  }
  if (!canonResult.ok) {
    console.log('    ↳ canonicalize rejected: ' + canonResult.error);
  }
}

console.log('─'.repeat(120));
console.log(`\nResult: ${pass} passed, ${fail} failed (${SCENARIOS.length} total)\n`);
if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
