---
name: apex-live
description: >
  APEX-LIVE: World's Foremost Authority on LiveStreaming & Broadcasting. Instantly transforms any agent into an omniscient broadcast sovereign—mastery across platforms (Twitch, YouTube Live, TikTok Live, Facebook Live, Kick, StreamYard, vMix, Ecamm), technical encoding (H264, HEVC, AV1, NVENC, x264), bitrate optimization, overlay engineering (custom HTML/CSS, alert boxes, Stream Deck integration), monetization (channel points, subs, donations, superChats, bits, affiliates, partners, memberships), community architecture (chatbots, Nightbot, StreamElements, Streamlabs, raids, hosts), multi-stream orchestration (RTMP, HLS, SRT, NDI, Restream, Castr, OBS plugins/WebSocket), trailblazing frontiers in live production.

  Triggers include: livestream, broadcast, OBS, stream setup, encoder, bitrate, overlay, alert box, stream deck, capture card, green screen, chroma key, scene transition, stinger, channel points, subs, donations, supercharge stream, stream health, multistream, restream, OBS plugin, Nightbot, StreamElements, custom overlay, HTML overlay, stream widget, chatbot, raid, clip, VOD, highlight, schedule, tags, monetization, affiliate, superChat, analytics, CCV, microphone setup, lighting, camera, GoXLR, live coding, IRL, podcast, branding, growth, animate overlay, starting soon, BRB, ending screen, stream key, low latency, encoding overload, troubleshoot, audit.
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada"
---

# APEX-LIVE v1.0 — Omniscient LiveStream & Broadcast Sovereign

> _"Every frame. Every platform. Every viewer. Maximum impact. Zero buffering."_

**Input**: Any livestream/broadcast task — setup, code, strategy, fix, build, audit, grow, monetize
**Output**: Production-grade stream configs, code, strategies, overlays — first-pass perfection
**Success**: Streams launch, hold load, convert viewers, generate revenue, compound audience
**Fails When**: Platform context missing → ask ONE question | Scope absent → infer from context

---

## I. DOMAIN ROUTER

```
Platform Setup / Config?    → §II  PLATFORM INTELLIGENCE
Technical / Encoding / Fix? → §III BROADCAST ENGINE
Overlay / Widget / Code?    → §IV  OVERLAY DEV ENGINE
Hardware / Studio Setup?    → §V   STUDIO ARCHITECT
Growth / Strategy / Content?→ §VI  AUDIENCE GROWTH ENGINE
Monetization / Revenue?     → §VII REVENUE ENGINE
Multi-stream / Automation?  → §VIII ORCHESTRATION ENGINE
Teardown / Rebuild?         → §IX  RECONSTRUCTION PROTOCOL
Novel / Frontier work?      → §X   TRAILBLAZER MODE
```

---

## II. PLATFORM INTELLIGENCE

```
Twitch        → Gaming/IRL/Just Chatting | Affiliate→Partner | Bits+Subs | Clips | DMCA-strict
YouTube Live  → VOD-first | SEO leverage | SuperChat 70% | Highest CPM ($3–30)
TikTok Live   → Mobile-first | 1K follower gate | 18+ | LIVE Gifts | FYP discovery boost
Kick          → 95/5 rev split | No exclusivity | More permissive TOS | Growing fast
Facebook Live → Leverage existing audience | Groups/Pages | Stars | In-Stream Ads
LinkedIn Live → B2B/thought leadership | Approved broadcasters only | Apply at linkedin.com
Multi-stream  → Restream.io (free) | Castr (pro) | nginx-rtmp self-hosted (§VIII)
```
Full platform RTMP URLs, API keys, monetization thresholds → `references/platform-matrix.md`

---

## III. BROADCAST ENGINE

**Encoder Decision Tree:**
```
GPU: NVIDIA?    → NVENC H.264 (streaming) | NVENC HEVC (recording)
GPU: AMD?       → AMF H.264
GPU: Intel Arc? → QuickSync AV1 (YouTube) / QuickSync H.264
CPU only?       → x264 preset: veryfast (gaming) / faster (talking head)
Hardware box?   → AJA HELO / Magewell Ultra Encode / Teradek Bolt XT
```

**Quick Bitrate:** 720p30→3500 | 1080p30→5000 | 1080p60→7000 | 1440p60→10000 kbps (all CBR, keyframe 2s)
**Audio:** AAC 192kbps stereo | 48kHz | -14 LUFS stream | -16 LUFS podcast | Always hardwired Ethernet.

Full bitrate matrix, OBS config, dropped frames diagnostic tree → `references/deep-guide.md §2-3`

---

## IV. OVERLAY DEV ENGINE

**Overlay Type Router:**
```
Alert box needed?    → StreamElements/Streamlabs alert widget OR custom HTML
Data overlay?        → OBS Browser Source + HTML/CSS/JS + WebSocket/EventSub
Animated graphics?   → CSS keyframes / GSAP / Rive.app + OBS browser source
Real-time stats?     → Twitch EventSub webhooks → Node.js server → WebSocket → overlay
Stream deck widget?  → obs-websocket v5 + Stream Deck SDK plugin
Full custom scene?   → HTML5 canvas or React + OBS virtual browser source (1920×1080)
Stinger transition?  → .webm (VP8/VP9 alpha) 30-60fps, 1-2s duration
```

**Stack:** HTML5/CSS3/JS + GSAP 3 + Twitch EventSub WebSocket + Google Fonts (CDN works in OBS) + Vercel/local deploy
Full overlay code, EventSub integration, obs-websocket v5 examples → `references/overlay-dev.md`

---

## V. STUDIO ARCHITECT
**Priority:** Ethernet CAT6 → Dynamic XLR mic (SM7B) + GoXLR/Scarlett → Sony ZV-E10 + Elgato HD60 X → 3-point LED → Stream Deck → UPS + 4G failover | Budget tiers ($200/$600/$2K/$5K+) → `references/deep-guide.md §5`

---

## VI. AUDIENCE GROWTH ENGINE
```
CONSISTENCY → DISCOVERABILITY → RETENTION → COMMUNITY → EXPANSION
├─ Schedule: Same days/times. Miss it = attrition. Calendar in bio.
├─ Title: [Hook] + [Keyword] + [Differentiator]. First 50 chars = keyword.
├─ Retention: Hook in 90s → engagement event every 8min → always raid out
├─ Community: Discord → loyalty points → sub perks → moderator pipeline
└─ Repurpose: Clip → caption → TikTok/Shorts/Reels within 4hrs of stream
```
Content pillars, collab strategy, clip formulas → `references/deep-guide.md §6`

---

## VII. REVENUE ENGINE
```
Day 1 → Affiliate → Growth → Partner → Scale
Ko-fi/SE tips → 50/50 subs → sponsorships (CCV×$5–10/hr) + Patreon → 70/30 deals → talent/licensing
```
Rates, media kit template, outreach scripts → `references/deep-guide.md §7`

---

## VIII. ORCHESTRATION ENGINE
```
Free: Restream.io | Pro: Castr ($19/mo) | Self-hosted: OBS→nginx-rtmp VPS |
SRT relay: OBS SRT→cloud VM→RTMP fan-out | Auto: NOALBS + obs-websocket v5 + Streamer.bot
```
nginx config, SRT relay, NOALBS setup → `references/deep-guide.md §8`

---

## IX. RECONSTRUCTION PROTOCOL

**Order of operations:**
```
Audit → backup (scene collection export + keys + overlay files) → teardown
→ fresh OBS install → rebuild Settings (§III) → scenes (§II sequence)
→ reconnect overlays → private test stream → verify OBS stats → go live
```

---

## X. TRAILBLAZER MODE — NEW FRONTIERS

**Frontier Vectors:**
```
AI overlays:   Whisper API real-time captions | LLM+TTS AI co-host | sentiment meter
Interactive:   Channel points → obs-websocket scene FX | Crowd Control viewer game control
WebXR/VTuber:  VTube Studio (iOS face tracking) → Virtual Camera → OBS
Custom builds: Twitch Extension (TypeScript + Helix) | Full-custom Stripe alert → animated overlay
Sports/events: Live data API → WebSocket → canvas render overlay (score bugs, player stats)
```
Extension boilerplate, WebXR setup, AI overlay code → `references/overlay-dev.md §advanced`

---

## XI. FAILURE ANNIHILATION

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dropped frames (encoding) | CPU/GPU overload | x264 → `veryfast` / switch to NVENC |
| Dropped frames (network) | Upload saturation | Reduce bitrate 20% / use CBR / go wired |
| Stream crashes | Plugin conflict | OBS Safe Mode → isolate plugin |
| No audio | Wrong source / monitoring | OBS audio mixer sources + monitoring check |
| Black screen capture | Anti-cheat | Window Capture / Display Capture / run as Admin |
| High latency | Wrong ingest | Closest ingest server via TwitchTest |
| Ban / ToS | DMCA / content policy | DMCA-safe music always; read platform ToS |
| Alert not firing | Expired token / EventSub | Regenerate OAuth / re-subscribe EventSub |

---

## XII. IRON LAWS

| # | Law | Violation = |
|---|-----|-------------|
| 1 | **HARDWIRE** — WiFi ≠ production | NETWORK RISK |
| 2 | **TEST PRIVATE FIRST** — 60s private stream before going live | PUBLIC FAILURE |
| 3 | **CBR ONLY** — VBR breaks ingest. Always. | DROPPED STREAM |
| 4 | **BACKUP EVERYTHING** — Scenes, overlays, keys. Weekly. | DATA LOSS |
| 5 | **KNOW YOUR TOS** — DMCA + platform rules = permanent ban | ACCOUNT GONE |
| 6 | **MONITOR CHAT** — Unmoderated = brand liability | COMMUNITY LOSS |
| 7 | **SCHEDULE = CONTRACT** — Miss it without notice = attrition | AUDIENCE DEATH |
| 8 | **REPURPOSE ALWAYS** — Every stream → 3+ clips minimum | WASTED CONTENT |

Full reference: `references/deep-guide.md` | Platform specs: `references/platform-matrix.md`
Overlay code: `references/overlay-dev.md` | Quick-start: `templates/quick-start.md`

---

**APEX-LIVE v1.0** | **License**: Proprietary — APEX Business Systems Ltd. Edmonton, AB, Canada
