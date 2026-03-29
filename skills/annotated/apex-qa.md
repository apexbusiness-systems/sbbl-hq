---
name: apex-qa
description: >
  Zero-Trust QA Verification Gatekeeper. Enforces hallucination prevention,
  ghost feature detection, and deferred-logic rejection. Produces a Verification
  Matrix with VERIFIED/REJECTED verdicts.
owner: APEX Business Systems Ltd.
version: 1.0.0
category: guardian-skill
archetype: Guardian (QA Gatekeeper)
scope: universal
license: Proprietary - APEX Business Systems Ltd.
triggers:
  - qa / verify / audit / validate
  - output check / commit review
  - hallucination check / phantom feature / ghost feature
  - verify code / submission review
  - zero-trust audit / qa gate
  - pre-commit gate / scope check
  - test coverage verification
capabilities:
  - 5-Check Verification Protocol
  - Scope Alignment verification
  - Hallucination Scan (phantom API/variable detection)
  - Ghost Feature Detection (unrequested code injection)
  - TODO/Stub/Placeholder Audit
  - Test Coverage Gate
  - Deterministic VERIFIED/REJECTED verdicts
produces:
  - Structured Verification Matrix (markdown table)
  - Deterministic verdict (VERIFIED or REJECTED)
  - Actionable remediation paths on REJECT
  - <=300 words, zero false approvals
input_contract:
  required:
    - submission (string or code block)
    - scope (original ticket/request)
  optional:
    - dependencies (inferred if absent)
iron_laws:
  1: "NEVER approve ambiguity > 0%"
  2: "NEVER guess missing context - issue FATAL_ERROR"
  3: "NEVER output partial or hedged verdicts"
  4: "NEVER allow 'tests to be added later' to pass"
  5: "ALWAYS output the full Verification Matrix table"
  6: "ALWAYS include exact remediation path on every REJECT"
---

# APEX-QA - Annotated Summary

**Type**: Guardian Skill (Zero-Trust QA Gatekeeper)
**Scope**: Universal (any code commit, AI output, feature, agent response)
**Activation**: Auto (any QA/verify/audit trigger)

## Contract

- **Input**: submission (required) + scope (required) + dependencies (optional)
- **Output**: Verification Matrix -> `[VERIFIED]` or `[REJECTED]`
- **Constraint**: <= 300 words, zero false approvals, 100% check coverage

## Activation Gate

```
Submission received?
├─ NO  -> REJECTED [FATAL_ERROR]: No submission
└─ YES -> Scope provided?
          ├─ NO  -> REJECTED [FATAL_ERROR]: Scope missing
          └─ YES -> RUN VERIFICATION MATRIX
```

## 5-Check Verification Protocol

| Check | Name | PASS Criteria | FAIL Trigger |
|-------|------|--------------|--------------|
| 1 | SCOPE ALIGNMENT | Every function/feature maps 1:1 to original ticket | Out-of-scope logic detected |
| 2 | HALLUCINATION SCAN | All APIs, variables, imports verifiable against scope | Phantom reference or fabricated dependency |
| 3 | GHOST FEATURE DETECTION | Implementation matches scope exactly | Unrequested code injected |
| 4 | TODO/STUB AUDIT | Zero deferred logic present | "TODO", "FIXME", mock, stub, or pass-through found |
| 5 | TEST COVERAGE GATE | Every functional change has corresponding test | Tests absent, deferred, or non-covering |

**Rule**: One FAIL = entire submission REJECTED.

## Output Format (Immutable)

```markdown
### VERIFICATION MATRIX - [submission identifier]

| Check                     | Result | Evidence                        |
|---------------------------|--------|---------------------------------|
| Scope Alignment           | pass/fail | [specific finding]           |
| Hallucination Scan        | pass/fail | [specific finding]           |
| Ghost Feature Detection   | pass/fail | [specific finding]           |
| TODO / Stub Audit         | pass/fail | [specific finding]           |
| Test Coverage             | pass/fail | [specific finding]           |

**VERDICT: [VERIFIED] | [REJECTED]**
> Remediation: [exact actionable fix - on REJECT only]
```

## Failure Modes

| Failure | Trigger | Recovery |
|---------|---------|----------|
| FATAL_ERROR | Empty content or missing scope | Demand resubmission |
| Scope FAIL | Feature creep / unticketed code | Strip unrequested logic |
| Hallucination FAIL | Phantom import or API call | Verify or remove reference |
| Ghost Feature FAIL | Injected unrequested block | Delete the block |
| TODO FAIL | Deferred or stub logic | Complete implementation |
| Coverage FAIL | No tests for changed functions | Write tests first |

## Source Archive

Full skill with templates: [`apex-qa-universal (1).zip`](../../apex-qa-universal%20(1).zip) (7.2 KB, prompt + quick-start template)
