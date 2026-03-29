---
name: apex-memory
description: >
  APEX-MEMORY: Exponentially enhance AI memory and context retention through
  intelligent compression, verification, and persistence protocols. Cross-session
  memory management with hallucination prevention.
owner: APEX Business Systems Ltd.
version: 2.0.0
category: domain-skill
archetype: Domain (Memory + Context Engineering)
scope: universal
license: Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada.
triggers:
  - long-context conversation (auto)
  - complex multi-step reasoning (auto)
  - cross-session continuity (auto)
  - "Activate APEX-Memory maximum capacity"
  - "APEX-Memory compress"
  - "APEX-Memory stats"
  - "APEX-Memory persist"
  - "APEX-Memory verify"
capabilities:
  - 3-Tier Memory Architecture (short/medium/long-term)
  - Compression Protocol (Primacy-Recency split, semantic dedup, map-reduce)
  - Verification Protocol (Zero Hallucination Shield)
  - Persistence Protocol (cross-session memory dumps)
  - Sub-Agent Delegation for deep research
  - Multi-Agent Coordination (shared memory across agent swarms)
  - Entity Extraction and indexing
produces:
  - Optimized context window with >90% information retention
  - <1% hallucination rate
  - Portable session dumps for cross-session continuity
  - Perfect fact recall from 50+ turns ago
scripts:
  - apex_compress.py (compress with quality verification)
  - apex_verify.py (audit responses for hallucinations)
  - apex_persist.py (generate session memory dumps)
  - apex_optimize.py (full optimization pipeline)
references:
  - compression-algorithms.md
  - context-engineering.md
  - cross-session-persistence.md
  - hallucination-prevention.md
  - memory-architecture.md
  - multi-agent-coordination.md
---

# APEX-MEMORY - Annotated Summary

**Type**: Domain Skill (Memory + Context Engineering)
**Scope**: Universal (any conversation, any agent)
**Activation**: Auto (background optimization every turn) + Manual overrides

## Triage Protocol (Entry Point)

| Context State | Tokens | Action |
|--------------|--------|--------|
| NEW SESSION / LOW | <4k | Initialize short-term memory, await 5 turns |
| MEDIUM | 4k-32k | Activate Compression Protocol, preserve last 5 turns verbatim |
| HIGH | >32k | Deep Optimization + Hallucination Check, promote to long-term |
| SESSION END | - | Activate Persistence Protocol, consolidate memory |

## 3-Tier Memory Architecture

| Tier | Name | Fidelity | Promotion Criteria |
|------|------|----------|-------------------|
| 1 | SHORT-TERM (Working) | 100% | Last 10-20 turns, real-time |
| 2 | MEDIUM-TERM (Session) | 90% | Compressed summaries, key facts |
| 3 | LONG-TERM (Persistent) | 95%+ | Critical entities, append-only, never deleted |

## Compression Protocol Rules

**NEVER compress**:
- Code blocks (keep verbatim with line refs)
- User instructions (keep verbatim)
- Attention Sinks (first 4 tokens)
- Most recent 5 turns (recency zone)
- Distinct topics into a single summary

**ALWAYS apply**:
- Primacy-Recency Split: Preserve first 20% + last 10% verbatim, compress middle 70%
- Semantic Dedup: >80% similar blocks -> keep canonical instance only
- Map-Reduce: Chunk middle context (1000 tok/chunk) -> summarize each -> merge
- Entity Extraction: Extract ALL named entities into retained index
- Quality Gate: Verify fact retention >= 90%

## Verification Protocol (Zero Hallucination Shield)

| Claim Type | Action |
|-----------|--------|
| General knowledge | State directly, no verification needed |
| Context-specific fact | Found in memory? -> Cite source turn. NOT found? -> Say "I don't have that." NEVER fabricate. |
| Inferred conclusion | State with hedge + cite evidence explicitly |
| Future/temporal claim | BLOCK. State cutoff boundary. |

## Persistence Protocol (Cross-Session)

Generates portable session dumps containing:
- Session ID + 3-sentence narrative
- Critical facts with source turn numbers
- Entities (people, systems, files)
- Pending actions
- Active constraints
- Context hash (integrity check)

## Advanced Capabilities

- Sub-Agent Delegation for deep research context forking
- Multi-Agent Coordination for shared memory across swarms
- Structured note-taking with external scratchpads
- Emergency context compaction with tabular state transfer

## Source Archive

Full skill with references and scripts: [`apex-memory-universal.zip`](../../apex-memory-universal.zip) (26 KB, 6 references, 4 scripts)
