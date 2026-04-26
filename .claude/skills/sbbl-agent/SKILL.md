---
name: sbbl-agent
description: >
  SBBL-AGENT: Project context profile for SBBL HQ, the three-league
  basketball super app.
version: 1.0.0
category: session-profile
scope: project
triggers:
  - SBBL
  - basketball
  - league
  - WBL
  - TGIF
  - Spring Edition
  - player
  - team
  - schedule
  - stats
  - game
  - livestream
  - broadcast
  - store
---

# SBBL-AGENT - SBBL HQ Session Context

## THE PRODUCT
Three-league basketball super app (Edmonton, AB):
1. Weekend Basketball League (WBL) - Competitive 5v5
2. TGIF League - Recreational, social-first
3. SBBL Spring Edition - Tournament bracket

## TECH STACK
Frontend: React + TypeScript + Tailwind + Framer Motion
Backend: Cloudflare Workers + Supabase (PostgreSQL + Realtime + Auth)
Payments: Stripe | Testing: Vitest + Playwright | CI: GitHub Actions

## BRAND
Background: #0A0A0A | Gold: #C9A84C | Text: #F5F5F0
Heading: Bebas Neue | Body: Inter

## DATABASE ACCESS
ADMIN: Full CRUD | COMMISSIONER: League-scoped
SCOREKEEPER: Stat entry | PLAYER: Own stats | PUBLIC: Read-only
Security Law: Every table MUST have RLS.

_SBBL-AGENT v1.0.0 - Proprietary - APEX Business Systems Ltd._
