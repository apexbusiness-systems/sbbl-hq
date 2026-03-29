---
title: APEX Skills Index - Annotated Reference
owner: APEX Business Systems Ltd.
updated: 2026-03-29
---

# APEX Skills Index - Annotated Reference

Complete annotated catalog of APEX custom skills for SBBL HQ and universal use.

## Skills by Category

### Meta-Skill (Universal)

| Skill | Version | Scope | Description |
|-------|---------|-------|-------------|
| [apex-power](apex-power.md) | 1.0.0 | Universal | Universal Meta-Skill for Omnipotent Execution. TDD, debugging, planning, verification, collaboration unified protocol. |

### Domain Skills

| Skill | Version | Scope | Description |
|-------|---------|-------|-------------|
| [apex-master-debug](apex-master-debug.md) | 1.0.0 | Universal | Omnipotent, Omniscient, Predictive Debugging Intelligence. 4 modes: Reactive, Predictive, Performance, Omega Scan. |
| [apex-frontend](apex-frontend.md) | 1.0.0 | Universal | Ultimate UI/UX + frontend engineering + debugging OS. 8 modes, 5 gates, cross-platform. |
| [omnidev-v2](omnidev-v2.md) | 2.0.0 | Universal | God-Mode Software Engineering. All languages, all domains. Code, debug, architect, deploy, secure, optimize, review, IP moat. |
| [apex-memory](apex-memory.md) | 2.0.0 | Universal | AI memory + context retention. 3-tier architecture, compression, hallucination prevention, cross-session persistence. |
| [apexomni-test](apexomni-test.md) | 1.0.0 | Universal | 20x Omnipotent Software Quality Intelligence. 48 test types, 10 execution modes, 20-item quality rubric. |

### Guardian Skills

| Skill | Version | Scope | Description |
|-------|---------|-------|-------------|
| [apex-qa](apex-qa.md) | 1.0.0 | Universal | Zero-Trust QA Verification Gatekeeper. 5-check protocol, VERIFIED/REJECTED verdicts. |

### Session Profiles

| Skill | Version | Scope | Description |
|-------|---------|-------|-------------|
| [sbbl-agent](sbbl-agent.md) | 1.0.0 | Project | SBBL HQ session context profile. Domain awareness, role routing, brand constraints. |

## Skill Relationship Map

```
apex-power (meta-skill, session start)
├── apex-master-debug (debugging tasks)
├── apex-frontend (UI/UX tasks)
├── omnidev-v2 (software engineering tasks)
├── apexomni-test (testing/QA tasks)
├── apex-memory (context management, background)
└── apex-qa (verification gate, pre-ship)

sbbl-agent (project context) → provides domain context to all above
```

## Source Artifacts

| Skill | Source Location | Format |
|-------|----------------|--------|
| sbbl-agent | `sbbl-agent.md` | Markdown |
| apex-power | `apex-power.md` | Markdown (339 lines) |
| apex-master-debug | `apex-master-debug-universal.md` | Markdown (580 lines) |
| apex-frontend | `apex-frontend-universal-skill.zip` | ZIP (SKILL.md + 8 playbooks + templates + examples) |
| omnidev-v2 | `omnidev-v2.zip` | ZIP (SKILL.md + 3 references) |
| apex-memory | `apex-memory-universal.zip` | ZIP (SKILL.md + 6 references + 4 scripts) |
| apex-qa | `apex-qa-universal (1).zip` | ZIP (SKILL.md + prompt + template) |
| apexomni-test | Provided inline | Skill definition |
