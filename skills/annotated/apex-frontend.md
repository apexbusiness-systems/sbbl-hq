---
name: apex-frontend
description: >
  Ultimate UI/UX + frontend engineering + debugging operating system for mobile,
  web, and desktop. Covers design, audit, implementation, debugging, performance,
  accessibility, design systems, and migration.
owner: APEX Business Systems Ltd.
version: 1.0.0
category: domain-skill
archetype: Domain (UI/UX + Frontend Engineering)
scope: universal
license: Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada.
triggers:
  - design / wireframe / flow / prototype / UI
  - review / improve / churn / funnel / complaints
  - build / implement / code (React, Swift, Kotlin, Flutter)
  - bug / broken / crash / wrong / doesn't work (frontend)
  - slow / jank / lag / memory / battery
  - accessibility / contrast / screen reader / keyboard
  - design system / components / tokens
  - port / rewrite / migrate / parity
capabilities:
  - 8 specialized modes with dedicated playbooks
  - 5 non-negotiable gates (UX, State, A11y, Perf, Ship)
  - Platform adapter (React/Vue/Svelte, SwiftUI, Compose, Flutter, RN)
  - 7 output templates (UX brief, screen spec, component spec, etc.)
  - 4 example references (design, debug, perf, a11y)
produces:
  - Design artifacts (flow maps, wireframe specs, UI tokens, interaction notes)
  - Engineering artifacts (component breakdown, state model, data/effects, test plan)
  - Verification packages (UX + a11y + perf + quality gates)
invocation:
  - "/apex-frontend design <idea or feature>"
  - "/apex-frontend audit <app/flow>"
  - "/apex-frontend implement <design + stack>"
  - "/apex-frontend debug <symptom + repro>"
  - "/apex-frontend perf <slow area>"
  - "/apex-frontend a11y <screen/flow>"
  - "/apex-frontend system <design system scope>"
  - "/apex-frontend migrate <from> <to> <component/screen>"
extended_thinking: "ultrathink"
---

<!-- Version: v1.0.0 | Date: 2026-04-04 | Status: Current -->

# APEX-FRONTEND - Annotated Summary

**Type**: Domain Skill (UI/UX + Frontend Engineering)
**Scope**: Universal (mobile, web, desktop - any platform/language)
**Activation**: Auto (any frontend/UI/UX trigger keyword) or via slash command

## Mode Router

| Request Contains | Mode | Playbook |
|-----------------|------|----------|
| design / wireframe / flow / prototype / UI | DESIGN | 01-design-playbook.md |
| review / improve / churn / funnel / complaints | AUDIT | 02-audit-playbook.md |
| build / implement / code | IMPLEMENT | 03-implementation-playbook.md |
| bug / broken / crash / wrong / doesn't work | DEBUG | 04-debugging-playbook.md |
| slow / jank / lag / memory / battery | PERF | 05-performance-playbook.md |
| accessibility / contrast / screen reader / keyboard | A11Y | 06-accessibility-playbook.md |
| design system / components / tokens | SYSTEM | 07-design-system-playbook.md |
| port / rewrite / migrate / parity | MIGRATE | 08-migration-playbook.md |

## The 5 Non-Negotiable Gates

| Gate | Criteria |
|------|----------|
| **UX Gate** | Users can answer: "Where am I?", "What can I do?", "What happens next?" Primary task has minimal steps, no dead ends, clear recovery. |
| **State Gate** | Every screen handles: loading, empty, error, success, disabled, offline, permission denied |
| **A11Y Gate** | Semantic roles/labels, focus order, contrast, target sizes, non-color cues |
| **Perf Gate** | Declared budget, profiled, hot path fixed, re-measured |
| **Ship Gate** | Analytics for funnel steps + rollback/flag plan + regression tests |

## Universal Output Format

1. Mode + Goal
2. Assumptions (explicit) + Constraints (platform, devices, locales, a11y)
3. Plan (ordered, <= 10 steps)
4. Deliverables (design artifacts and/or code strategy)
5. Verification Gates (pass/fail)
6. Risks + Mitigations
7. Next actions

## Platform Adapter

| Platform | Component Model |
|----------|----------------|
| React/Vue/Svelte | component + props/state + effects + routing |
| SwiftUI/UIKit | View + State/Observable + Coordinator/Navigation |
| Jetpack Compose | Composable + state hoisting + Nav + Flow/Coroutines |
| Flutter | Widget + state + Navigator + async |
| React Native | component + hooks + navigation + native bridges |

## Templates

- UX brief, Screen spec, Component spec, Bug triage, Perf budget, A11y audit, Design system spec

## Failure Patterns

- Pretty UI, wrong problem (no JTBD/metric/test)
- No state design (missing loading/empty/error/permission/offline)
- Inconsistent system (raw colors/spacing, duplicate components)
- Gesture-only UX (discoverability failure)
- Debugging by guessing (no repro/minimization/instrumentation)
- Perf "optimizations" unmeasured
- A11y bolted on (unlabeled controls, broken focus, tiny targets)
- Cross-platform "identical UI" (violates platform conventions)

## Source Archive

Full skill with playbooks, templates, examples, scripts: [`apex-frontend-universal-skill.zip`](../../apex-frontend-universal-skill.zip) (15 KB, 8 playbooks)
