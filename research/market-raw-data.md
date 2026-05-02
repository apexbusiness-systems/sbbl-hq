# APEX-OmniHub Research — Raw Data
**Date:** 2026-05-02  
**Branch:** claude/research-ai-developments-W5FeW  
**Scope:** SBBL-HQ v1.4.0 (sbbl-hq.icu) + APEX-OmniHub ecosystem  
**Method:** Web search batches A–E + full repo scope

---

## REPO SCOPE FINDINGS (truth-only, no hallucination)

### Stack (package.json v1.4.0)
- Frontend: React 18.3.1 + TypeScript 5.8.3 + Vite 5.4.19 (SWC)
- Styling: Tailwind CSS 3.4.17 (dark-first, #C9A84C gold)
- UI: shadcn/ui (Radix + CVA + lucide-react)
- State: React Context (Auth/App/Bag) + TanStack Query v5.83.0
- Offline: RxDB 17.1.0 + IndexedDB + VitePWA/Workbox
- Database: Supabase + PostgreSQL + Realtime + Auth + Storage
- Backend/API: Cloudflare Workers (single worker, wrangler 4.8.0)
- Video: react-player 2.16.0 + @eyevinn/webrtc-player 0.13.0 + @eyevinn/whip-web-client 1.1.7
- Payments: Stripe
- Email: Resend
- CAPTCHA: Cloudflare Turnstile
- Monitoring: Sentry (frontend + worker), @sentry/react 10.47.0
- Mobile: Capacitor 8.3.0 (iOS + Android)
- CI/CD: GitHub Actions → Cloudflare Workers

### AI Currently in Use (confirmed from bindings.d.ts + worker code)
- `GROQ_API_KEY` — Groq Vision for scoreboard OCR (`/ops/event/parse`, `/ops/potg/parse`)
- `OMNIHUB_SYNC_URL` + `OMNIHUB_SIGNING_SECRET` + `OMNIHUB_VERIFY_KEY` — OmniHub external sync

### OmniPort Integration Layer (src/lib/omniport.ts — confirmed)
- `IngressEnvelope` type: `correlation_id`, `source_type`, `actor_id`, `device_id`, `league_id`, `entity_type`, `entity_id`, `payload`, `risk_lane`, `requires_man_approval`, `trace_id`, `created_at`
- `IngressSourceType`: `'text' | 'voice' | 'webhook' | 'upload' | 'admin_mutation' | 'sync_packet'`
- `RiskLane`: `'GREEN' | 'RED' | 'BLOCKED'`
- Risk classification: BLOCKED (DDL patterns), RED (manual approval), GREEN (auto-process)
- `normalizeIngress()` — canonical ingress normalization function

### Pages (28 confirmed)
AppHome, Home, Live, Schedules, Store, Profiles, Stats, Leaderboards, Media,
Scores, Teams, Login, Onboarding, Billing, Settings, Ops, OpsBiometrics,
Overlay, OverlayControl, Support, PrivacyPolicy, TermsOfService, Digest,
Engage, Scorekeeper, NotFound, Offline, Index

### Worker Routes (confirmed files)
- `src/worker/routes/public.ts`
- `src/worker/routes/stream-qoe.ts`
- `src/worker/routes/biometrics.ts`
- `src/worker/routes/digest.ts`
- `src/worker/routes/engagement.ts`
- `src/worker/routes/highlights.ts`
- `src/worker/routes/obs.ts`
- `src/worker/routes/overlay-events.ts`
- `src/worker/routes/overlay.ts`
- `src/worker/routes/replay.ts`
- `src/worker/routes/sponsors.ts`
- `src/worker/routes/tokens.ts`

### Supabase Migrations (50 total — last 10 relevant to AI/features)
- `20260417100000_overlay_engagement_sponsor_digest.sql` — overlay, engagement, sponsors, digest
- `20260417140000_broadcast_integration.sql` — broadcast
- `20260418000100_biometric_and_mic_up.sql` — biometric data + Mic-Up series
- `20260418120000_playback_provider_abstraction.sql` — playback provider abstraction
- `20260419100000_make_highlight_clips_game_id_nullable.sql` — highlight_clips table exists, game_id nullable
- `20260419101500_fan_token_system.sql` — fan token economy
- `20260419110000_make_watch_parties_game_id_nullable.sql` — watch_parties table
- `20260419120000_biometric_snapshots.sql` — biometric snapshot storage
- `20260419130000_replay_entitlements.sql` — replay access control
- `202603290001_omniport_outbox.sql` — OmniPort outbox pattern

### Confirmed AI Gap Areas (zero mock data, only what exists in repo)
1. **No AI-generated commentary** — overlay ticker is manual; no AI text generation
2. **No automated highlight clip creation** — `highlight_clips` table exists but no auto-generation pipeline
3. **No pgvector / semantic search** — no vector embeddings on players, games, media
4. **No AI fan digest personalization** — `/digest` route + page exist but no ML personalization
5. **No AI sentiment analysis on live chat** — `stream_comments` table exists, no sentiment model
6. **No AI player performance prediction** — stats exist, no ML scoring
7. **No voice AI / Realtime API integration** — `source_type: 'voice'` defined in OmniPort but unused
8. **No MCP server integration** — AGENTS.md convention not wired in
9. **Groq models not updated** — likely still using older models, not Llama 4 Scout / GPT-OSS

---

## SEARCH BATCH A — PLATFORM INTELLIGENCE (Replit)

### Status: VERIFIED — ACTIVE, DATED, CONSTRAINED
Source: https://replit.com/pricing, https://www.nocode.mba/articles/replit-pricing, https://p0stman.com/guides/replit-limitations

**Replit Free (Starter) Tier 2026:**
- 512MB RAM, 0.5 vCPU
- Repls sleep after 5 minutes (10-30s cold start on wakeup)
- 1 free published app (30-day deployment, re-publishable)
- No custom domains on free tier (replit.app subdomain only)
- 10 AI Agent checkpoints/month
- 10GB storage, 10GiB data transfer
- No always-on capability

**Replit Paid Plans 2026:**
- Core: $25/month (or $20/month annually)
- Pro: $100/month for up to 15 builders (launched Feb 2026) — replaces old Teams plan
- Pro includes: credit rollover, priority support, tiered credit discounts

**Replit Free Build Day Status: UNVERIFIED / DOES NOT EXIST**
- No evidence found in any 2025-2026 source of a "Free Build Day" as a named promotion
- The concept may be informal community jargon or an expired one-off promotion
- Recommendation: Treat Replit as paid-tier-only for production use

**Lock-In Risks:**
- Database hosted on Replit = lock-in (PostgreSQL managed by Replit, not portable by default)
- Long-term hosting on free tier = service interruptions (sleep, 30-day expiry)
- Exit path: Export project to GitHub (git push), redeploy on Railway/Fly.io/Vercel

**Sources:**
- https://replit.com/pricing
- https://www.nocode.mba/articles/replit-pricing
- https://p0stman.com/guides/replit-limitations
- https://pecollective.com/tools/replit-pricing/
- https://hackceleration.com/replit-review/

---

## SEARCH BATCH B — MARKET GAP SCAN

### Key Pain Points (2025-2026)
Source: https://dev.to/kesimo/the-next-generation-of-actually-useful-micro-saas-ideas-2026-edition-j23, https://superframeworks.com/articles/best-micro-saas-ideas-solopreneurs

1. **AI Infrastructure Gap** — teams need simple AI-integrated internal tools; low-code builders missing
2. **Hyper-specialized AI** — industry-specific tools (healthcare, legal, sports) outperform generic AI
3. **Professionalization of niche operators** — league managers, event coordinators, content producers need "professional layer"
4. **Document/content automation** — admins spending hours on manual recap, newsletter, social copy
5. **Real-time data + AI** — fans expect 35% real-time updates, 30% personalized content (IBM/Stats Perform 2025 study)

### Fastest Growing Categories 2025-2026
Source: https://saasytrends.com/blog/saas-trends, https://www.ideaplan.io/ideas/trends

- AI-Powered SaaS: $71.54B (2024) → projected $775.44B by 2031, 38.28% CAGR
- Vertical SaaS: $720.44B by 2028, 25.89% CAGR
- Micro-SaaS: 30% annual growth, fastest to profitability
- Creator Economy: $314B in 2026, 23.4% CAGR
- Embedded Finance: $156B in 2026, 23.8% CAGR

### Sports Tech AI Market
Source: https://wsc-sports.com/blog/industry-insights/sports-technology-revolution-how-genai-is-creating-billion-dollar-opportunities/, https://watchers.io/post/sports-industry-trends, https://www.statsperform.com/resource/2026-fan-engagement-monetisation-and-ai-trends-survey/

- Global AI in sports market: $8.9B (2024) → $27.6B by 2030
- 91% of fans using apps during live events engage for real-time commentary (44%), stats (41%), enhanced experiences (35%)
- WSC Sports: 8M+ AI video clips generated in H1 2025 (52% YoY surge, zero staff added)
- IBM study: fans demand more dynamic digital content powered by AI
- AI sports media: live frame extraction, instant analysis, video language models

---

## SEARCH BATCH C — COMPETITOR SATURATION

### AI Sports Commentary / Narrative Generation
- WSC Sports (enterprise, $500K+/year contracts, B2B only for major leagues)
- Statsperform / Opta (enterprise, press release generation for NFL/NBA/Premier League)
- Magnifi (enterprise video AI, not self-serve)
- **Gap:** Zero affordable tools for amateur/semi-pro league operators (<1000 viewers)

### AI Highlight Generation (amateur leagues)
- Eklipse.gg (gaming/Twitch, NOT sports, ~$20/month)
- RevID.ai (generic video tool, not sports-data-aware)
- **Gap:** No tool that reads your own league's stat data + video to auto-generate highlights

### Fan Digest / Newsletter Automation for sports leagues
- Mailchimp / Beehiiv (generic, no sports data integration)
- LeagueApps (league management, no AI narrative)
- **Gap:** No tool that auto-writes post-game recaps using actual stat data

---

## SEARCH BATCH D — WILLINGNESS TO PAY SIGNALS

Source: https://www.getmonetizely.com/articles/saas-pricing-benchmarks-2025-how-do-your-monetization-metrics-stack-up, https://primer.goldendoorasset.com/software/pricing

- Credit-based models up 2.25x in 2025 (79 → from 35 companies in PricingSaaS 500)
- AI bundled into plans: $2.50-$5/user/month price increase accepted
- Products launched 2024-2025 with AI core grew 2x faster vs traditional
- First revenue fastest when price "feels slightly too high at launch"
- Micro-SaaS $1K MRR achievable in 2-6 months with focused execution
- $10K MRR median: 18-24 months
- Community-led channels (Reddit, Discord, niche forums) = primary first-revenue driver

---

## SEARCH BATCH E — KEY AI DEVELOPMENTS TO INTEGRATE

### Models & Infrastructure
Source: https://kersai.com/ai-breakthroughs-april-2026-models-funding-shifts/, https://llm-stats.com/ai-news

- **GPT-5.4** (OpenAI, March 5 2026) — leads coding, reasoning, computer use simultaneously
- **Gemini 3.1 Pro** (Google) — tied with GPT-5.4 for power; multimodal
- **Gemma 4** (Google, Apache 2.0) — open model, advanced reasoning + agentic workflows
- **Groq 3 LPU** (Groq, March 2026) — 1,500 tokens/second, $20B Nvidia partnership
- **Llama 4 Scout** — 750 tokens/second on Groq LPU
- **GPT-OSS 20B** — 1,000 tokens/second on Groq LPU
- **Kimi K2** — now available on Cloudflare Workers AI model catalog

### Groq-Specific (directly relevant to SBBL-HQ's existing GROQ_API_KEY)
Source: https://console.groq.com/docs/models, https://crazyrouter.com/en/blog/groq-api-complete-guide-fastest-inference-2026

- **Groq Compound** — agentic system (web search + code execution + multi-step reasoning), now GA
- **Prompt Caching** — 50% off input tokens for repeated prompts
- **Batch API** — 50% off real-time rates for async jobs
- **New models**: Llama 4 Scout, GPT-OSS, Kimi K2, Qwen3
- Vision models: support tool use + JSON mode (used for OCR already in SBBL-HQ)

### Cloudflare Workers AI (directly relevant to SBBL-HQ's worker architecture)
Source: https://blog.cloudflare.com/ai-platform/, https://softprom.com/cloudflare-agents-week-2026-20-new-features-for-ai-agents

- **Agents Week 2026**: 20+ new features for AI agents on Workers platform
- **50+ open-source models** via unified API (Llama, Mistral, Gemma, Kimi K2.5)
- **Dedicated GPU inference pools** — consistent latency for production workloads
- **AI Gateway**: unified inference layer, 14+ providers, multimodal
- **AI Firewall**: security layer for AI traffic
- **Custom model support**: bring-your-own-model for Enterprise

### Agent Frameworks & Protocols
Source: https://composio.dev/content/claude-agents-sdk-vs-openai-agents-sdk-vs-google-adk, https://qubittool.com/blog/ai-agent-framework-comparison-2026

- **Model Context Protocol (MCP)** — open standard, now 2026 baseline
- **Agent-to-Agent (A2A)** protocol — Google, now in LangGraph/CrewAI/LlamaIndex/AutoGen
- **AGENTS.md convention** — OpenAI, becoming standard repo convention
- **Claude Agent SDK** — pip install claude-agent-sdk; max_budget_usd; auto context compaction
- **OpenAI Agents SDK** — Python/TypeScript, multi-agent orchestration

### Supabase AI Features (relevant to existing Supabase usage)
Source: https://supabase.com/docs/guides/ai, https://supabase.com/modules/vector

- **pgvector** — vector embeddings storage + similarity search (built-in extension)
- **AI Assistant in dashboard** — SQL editor CMD+K inline AI, security/performance suggestions
- **Edge Functions** for Anthropic/OpenAI/HuggingFace integrations
- **$200M Series E** at $2B valuation (April 2025) — platform is well-funded, stable

### Voice AI / Realtime
Source: https://openai.com/index/introducing-gpt-realtime/

- **OpenAI gpt-realtime** — GA August 2025; speech-to-speech, no STT→LLM→TTS chain
- Accuracy: 82.8% (up from 65.6%); function calling 66.5% (up from 49.7%)
- Supports MCP server, image input, SIP phone calling
- OmniPort already defines `source_type: 'voice'` — slot ready

### Video AI & Streaming
Source: https://www.sportsvideo.org/2026/04/07/nab-2026-eluvio-introduces-inline-ai-video-intelligence-and-updated-evie/, https://www.nanocosmos.net/blog/webrtc-latency/

- **Eluvio EVIE** (NAB 2026): inline frame-accurate AI for live sports, auto-highlight, social clips
- **Media over QUIC (MoQ)**: ~1s latency, simpler than WebRTC signaling, production-ready at NAB 2026
- **WHIP IETF RFC** (2024): standards-track RFC for WebRTC ingestion (SBBL already uses WHEP)
- **AI noise cancellation + language translation** built into WebRTC pipelines

---

## EVIDENCE QUALITY RATINGS

| Claim | Confidence | Source |
|---|---|---|
| Groq 3 LPU at 1,500 tok/s | HIGH | crazyrouter.com, console.groq.com |
| GPT-5.4 released March 5 2026 | HIGH | kersai.com, crescendo.ai |
| Replit Free Build Day | UNVERIFIED | No source found |
| Replit Starter: 512MB, 5min sleep | HIGH | p0stman.com, nocode.mba |
| AI sports market $8.9B → $27.6B by 2030 | HIGH | wsc-sports.com, sportsvideo.org |
| MCP as 2026 baseline | HIGH | composio.dev, qubittool.com |
| Supabase $200M Series E Apr 2025 | HIGH | medium.com @takafumi.endo |
| gpt-realtime GA August 2025 | HIGH | openai.com/index/introducing-gpt-realtime |
| Cloudflare Agents Week 2026: 20+ features | HIGH | softprom.com |
| pgvector in Supabase | HIGH | supabase.com/docs |
| Groq Compound now GA | HIGH | console.groq.com, crazyrouter.com |
| Micro-SaaS 30% annual growth | MEDIUM | saasytrends.com |
| $10K MRR in 18-24 months | MEDIUM | saasranger.com, softwareseni.com |

---

## REJECTED IDEAS (HARD REJECTION FILTERS)

| Idea | Rejection Reason |
|---|---|
| Generic AI meeting assistant | Saturated: Otter.ai, Fireflies, Zoom AI — 10K+ reviews |
| AI code review tool | Saturated: GitHub Copilot, Cursor, Coderabbit — inside Microsoft/GitHub |
| AI email management | Saturated + becoming commodity inside Google/Microsoft |
| AI scheduling assistant | Saturated: Calendly, Motion, Reclaim.ai — 3+ funded incumbents |
| Healthcare AI documentation | HIPAA primary + regulated; legally restricted |
| AI financial advisor | Fintech license required; legally regulated |
| Biotech / drug discovery | Hardware + deep infrastructure dependency |
| AI image generation | Commodity in Google/Adobe/Microsoft within 12 months |
| Generic chatbot builder | Saturated + commodity inside major platforms |
| Sports betting AI | Legally regulated; jurisdiction-specific licensing |
