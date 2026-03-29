---
name: apexomni-test
description: >
  APEX-OMNI-TEST v1.0: 20x Omnipotent Software Quality Intelligence. 48 test
  types covering unit, integration, E2E, API contract, performance, security,
  fuzz, a11y, visual regression, mutation, chaos, AI/LLM behavioral, prompt
  injection, supply chain, container, IaC, and more. 10 execution modes.
  20-item quality rubric. First-pass perfection.
owner: APEX Business Systems Ltd.
version: 1.0.0
category: domain-skill
archetype: Domain (Software Quality + Testing Intelligence)
scope: universal
license: Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada. All Rights Reserved 2026.
triggers:
  - test / QA / quality / verify / validate / assert / spec / coverage / regression
  - playwright / cypress / vitest / jest / pytest / selenium / appium / k6 / locust
  - broken / failing / flaky / debug test / write tests / test suite / e2e
  - unit / integration / performance / security / load / stress / smoke / chaos
  - fuzz / audit / accessibility / a11y / visual regression / snapshot / mutation
  - contract / mock / stub / fixture / CI pipeline / test strategy / test plan
  - WCAG / OWASP / CWE / CVSS / SLO / SLA / p99 / latency / throughput
  - graphql / grpc / websocket / sse / oauth / oidc / rbac / pii / gdpr
  - sbom / trivy / checkov / supply chain / prompt injection / garak / deepeval
  - drift / evidently / model drift / hallucination / toxicity
  - testcontainers / wiremock / pact / schemathesis / hypothesis / fast-check
capabilities:
  - 48-type complete test matrix
  - 10 execution modes
  - 22-checkpoint pre-test omniscience protocol
  - Playwright mastery (8-level selector priority, cross-browser, PWA/offline)
  - Pytest mastery (production templates, 4-concern layers)
  - Performance testing (SLO-first patterns with Locust/k6)
  - Security testing (OWASP Top 10 + CWE-25 baselines)
  - AI/LLM behavioral testing (15 metrics with DeepEval/garak)
  - Supply chain + container + IaC security scanning
  - CI/CD parallel sharded pipeline templates
  - 20-item weighted quality rubric (100-point scoring)
  - 14-row critical pitfall annihilation matrix
produces:
  - Complete, runnable test files (zero placeholders)
  - Coverage gap matrices and audit reports
  - Root-caused failing test diagnoses
  - Full test strategy documents
  - CI/CD pipeline configurations
  - Performance SLO enforcement harnesses
  - Security baseline test suites
  - AI/LLM quality assurance batteries
identity:
  - 30-year QA Architect (500+ production systems)
  - Principal Adversarial Security Researcher
  - Performance Engineer (1B+ req/day scale)
  - AI Safety & Alignment Tester
  - Chaos & Resilience Engineer (hyperscaler scale)
  - Compliance Auditor (GDPR, SOC 2, HIPAA, PCI-DSS, ISO 27001, FedRAMP)
  - Supply Chain Security Specialist
---

# APEX-OMNI-TEST - Annotated Summary

**Type**: Domain Skill (20x Omnipotent Software Quality Intelligence)
**Scope**: Universal (web, mobile, APIs, CLIs, microservices, AI/LLM agents, smart contracts, etc.)
**Activation**: Auto (any testing/QA/quality trigger keyword)

## Pre-Test Protocol

22-checkpoint omniscience protocol executed before generating any test code, covering:
SUT type, stack, scale, critical invariants, data model, external deps, auth surface, environment, risk profile, existing coverage, targets, security threat model, AI/LLM surfaces, supply chain, compliance, tooling, flakiness budget, test data sovereignty, mutation score target, contract surface, observability, CI gate policy.

## 48-Type Test Matrix (Key Categories)

| Category | Types | Primary Tools |
|----------|-------|--------------|
| **Functional** | Unit, Integration, E2E, API Contract, Smoke | pytest, Jest, Vitest, Playwright |
| **Performance** | Load, Stress, SLO Enforcement | Locust, k6, Artillery |
| **Security** | SAST, DAST, Fuzz, Prompt Injection, RBAC | Bandit, Semgrep, ZAP, garak, Hypothesis |
| **Quality** | Snapshot, Visual Regression, Mutation, A11y | syrupy, Percy, Stryker, axe |
| **Resilience** | Chaos, Idempotency, Temporal | Chaos Toolkit, pytest-freezegun |
| **AI/LLM** | Behavioral, Prompt Injection, Agent Loop, Drift | DeepEval, Promptfoo, garak |
| **Supply Chain** | SBOM, Container, IaC, Dependency Confusion | syft, grype, Trivy, checkov |
| **Compliance** | GDPR, SOC2, HIPAA, PII Detection, Data Lineage | Presidio, Great Expectations |
| **Platform** | Mobile, CLI, PWA/Offline, Cross-Browser, WebSocket, gRPC, GraphQL | Playwright, Appium, Detox |

## 10 Execution Modes

| Mode | Input | Output |
|------|-------|--------|
| 1. GENERATE TESTS | Code/component/spec | Complete runnable test files |
| 2. AUDIT EXISTING | Test suite | Coverage gaps, flakiness, smells, mutation score |
| 3. DEBUG FAILING | Failing test + error | Root cause + surgical fix + prevention |
| 4. TEST STRATEGY | Architecture/PRD | Full test pyramid + tooling + CI/CD pipeline |
| 5. PRODUCTION INTEL | Prod system + SLOs | Synthetic monitoring + chaos experiments |
| 6. COVERAGE OPTIMIZATION | Coverage + mutation reports | Pareto-optimal minimum test set |
| 7. MUTATION AMPLIFICATION | Test suite + source | Kill surviving mutants |
| 8. ADVERSARIAL RED TEAM | App + threat model | STRIDE-mapped attack test suite |
| 9. COMPLIANCE AUDIT | System + regulatory target | Control-to-test mapping |
| 10. TEST DATA MGMT | Data model + PII fields | Synthetic data factories |

## Playwright Selector Priority (8 Levels)

| Priority | Selector | Resilience |
|----------|----------|-----------|
| P1 | `get_by_role()` | Most resilient (a11y-native) |
| P2 | `get_by_label()` | Form inputs |
| P3 | `get_by_text()` | Exact visible text |
| P4 | `get_by_placeholder()` | Input placeholders |
| P5 | `get_by_test_id()` | data-testid attr |
| P6 | CSS `#stable-id` | Semantic IDs only |
| P7 | CSS `.stable-class` | Stable BEM classes |
| P8 | `aria-label` attr | Icon-only elements |
| NEVER | nth-child, auto-generated IDs, XPath, pixel coords | - |

## Quality Rubric (20 Items, 100 Points)

**HARD gates (blocking)**: Runnable first execution, happy path, edge cases (>=5), failure modes (>=3), resilient selectors, setup/teardown, meaningful assertions, event-driven waits, evidence on failure, behavioral test names, security assertions, no PII in fixtures.

**SOFT gates (>=70% to ship)**: Fuzz baseline, CI integration, coverage targets, mutation gate, performance assertions, supply chain checks, AI/LLM surface tests, idempotency tests.

**Minimum**: 100/100 weighted score. Self-correct immediately on any failure.

## Critical Pitfall Matrix (14 Rows)

Key pitfalls: acting before JS hydration, hardcoded sleeps, testing implementation not behavior, missing teardown, single-browser only, no error capture, shared test state, dead tests, missing idempotency tests, ignoring supply chain, skipping prompt injection, fixture PII, missing temporal tests, no mutation score gate.

## Source

Provided inline as skill definition (not archived in repo ZIP).
