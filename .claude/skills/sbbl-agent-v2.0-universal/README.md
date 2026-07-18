# SBBL-AGENT v2.0 — Universal Edition

Vendor-agnostic skill package for SBBL HQ. Works with any LLM.

## Installation

### Option A: System Prompt
Paste the contents of `SKILL.md` as your system prompt.

### Option B: Context Injection
Prepend `SKILL.md` to every message thread before your question.

### Option C: Tool/Function Calling Systems
Register `SKILL.md` as a persistent context document in your LLM framework.

## Loading References
Reference files are loaded on-demand. Include them in context when working in that domain:
- Broadcast/streaming work → include `references/broadcast-deep.md`
- OmniBridge work → include `references/omnibridge-deep.md`
- Security/RLS work → include `references/security-deep.md`
- API/route work → include `references/api-routes-deep.md`
- DevOps/infra work → include `references/operations-deep.md`
- Full DB/code work → include `references/cto-deep.md`
- Before ANY change → include `references/hard-rules.md`

## Quick Validation
Ask your LLM: "What is the SBBL HQ worker name and why is it frozen?"
Expected: "sbbl-hq-worker — renaming breaks custom domains and all Cloudflare secrets."
