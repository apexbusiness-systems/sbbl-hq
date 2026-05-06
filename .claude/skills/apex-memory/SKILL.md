---
name: apex-memory
description: >
  APEX-MEMORY: AI memory and context retention engine. 3-tier hierarchical
  memory, intelligent compression, hallucination prevention.
version: 2.0.0
category: domain-skill
scope: universal
triggers:
  - long conversation
  - complex multi-step reasoning
  - cross-session continuity
  - memory compress
  - memory persist
  - memory stats
  - memory verify
---

# APEX-MEMORY - Cognitive Memory Persistence Engine

## 3-TIER MEMORY ARCHITECTURE
- TIER 1 SHORT-TERM: Last 10-20 turns, 100% fidelity
- TIER 2 MEDIUM-TERM: Compressed summaries, 90% accuracy
- TIER 3 LONG-TERM: Critical entities + constraints, append-only

## COMPRESSION PROTOCOL
Trigger: Every 10 turns OR context > 75% full
- Primacy-Recency Split: Preserve first 20% + last 10% verbatim
- Semantic Dedup: >80% similar blocks > keep canonical only
- Map-Reduce: Chunk > summarize > merge chronologically
- Quality Gate: Fact retention >= 90%

## VERIFICATION PROTOCOL (Zero Hallucination)
- General knowledge > state directly
- Context-specific > found in memory? state with source turn : STOP
- Inferred > state with hedge and evidence
- Future/temporal > BLOCK

_APEX-Memory v2.0.0 - Proprietary - APEX Business Systems Ltd._
