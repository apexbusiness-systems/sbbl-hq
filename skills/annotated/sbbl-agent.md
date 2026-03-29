---
name: sbbl-agent
description: Session skill profile for SBBL HQ execution contexts.
owner: APEX Business Systems Ltd.
version: 1.0.0
category: session-profile
archetype: Context
scope: project-specific
triggers:
  - session start on SBBL HQ repo
  - any SBBL/WBL/TGIFBL task
capabilities:
  - Domain context capture (WBL, TGIF, Spring Edition)
  - Role routing (engineering, ops, GTM, DevOps, security, design)
  - Brand and operating constraint enforcement
constraints:
  - Dark-gold design system
  - Realtime-first architecture
  - RLS on every table
  - Test before merge
produces: Contextualized session with domain awareness and role routing
---

# SBBL Agent Session Profile

**Type**: Session Context Skill
**Scope**: Project-specific (SBBL HQ only)
**Runtime Behavior**: None (documentation/context only)

## Purpose

- Capture the SBBL HQ domain context (WBL, TGIF, Spring Edition).
- Define role routing across engineering, ops, GTM, DevOps, security, and design.
- Preserve brand and operating constraints (dark-gold design, realtime-first, RLS-on-every-table, test-before-merge).

## Activation

Auto-activates at session start when working on the SBBL HQ repository. Provides domain context to other skills and agents.

## Integration Points

- Works alongside `apex-power` for execution protocol
- Works alongside `apex-master-debug` for domain-aware debugging
- Works alongside `apex-frontend` for UI/UX aligned to SBBL brand constraints

## Scope Notes

- This file is documentation only and introduces no runtime behavior.
- Use with existing project standards and AGENTS.md instructions.
