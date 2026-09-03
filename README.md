# ContentX & RoleplayX: AI Agent Quality Infrastructure

> **"Test AI Agents Before They Reach Production."**  
> *Connect any AI agent, simulate thousands of synthetic users, discover hidden failure patterns, and block unsafe releases.*

[![Build & Test](https://img.shields.io/badge/Tests-326%2F326%20Passing-brightgreen)](https://github.com/Rexmeta/ContentX)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 🧭 Overview & Platform Separation

ContentX and RoleplayX together form an enterprise-grade **AI Agent Quality & Simulation Platform**:

```text
                  CONTENTX
        ┌─────────────────────────┐
        │ AI Simulation Authoring │
        │ World / Persona         │
        │ Population / Scenario   │
        │ Reference Benchmark     │
        │ Canonical SimulationSpec│
        └────────────┬────────────┘
                     │ (WHAT to test)
                     ▼
                ROLEPLAYX
        ┌─────────────────────────┐
        │ AI Agent QA & Gate      │
        │ CONNECT / Gateway       │
        │ SIMULATE (1,000+ runs)  │
        │ EVALUATE (Multi-Layer)  │
        │ DISCOVER (Failures)     │
        │ ADAPTIVE STRESS (Loop)  │
        │ COMPARE (Simpson's Gate)│
        │ PROVE (Evidence Package)│
        └────────────┬────────────┘
                     │ (HOW to test & gate)
                     ▼
             PRODUCTION RELEASE
```

- **ContentX (Simulation & Benchmark Compiler)**: Authors scenarios, multi-dimensional populations, rubrics, and formal `SimulationSpec` definitions.
- **RoleplayX (Agent Quality Infrastructure)**: Connects external agents (OpenAI, Claude, Gemini, HTTP HMAC, MCP, SDK), orchestrates 1,000+ simulation runs, evaluates with multi-layer judges, discovers hidden failure patterns, amplifies weaknesses via adaptive stress, detects Simpson's Paradox regressions, and gates CI/CD deployments.

---

## 🛡️ Scientific Proof Hierarchy

We strictly differentiate the levels of validation to maintain rigorous scientific and commercial honesty:

```text
LEVEL 1: Infrastructure Proof (STATUS: VALIDATED)
──────────────────────────────────────────────────────────────────────────────
• Reference Agent Integration & 8-Step Preflight Check
• 1,000+ Executed Synthetic Simulation Trajectories
• Controlled Failure Injection & Closed-Loop Adaptive Stress Amplification (6.42x)
• Multi-Factor Regression Intelligence & Tamper Detection Checksums

             ↓

LEVEL 2: External-Agent Technical Proof (STATUS: VALIDATED)
──────────────────────────────────────────────────────────────────────────────
• Standalone External Agent Validation Fixture (ApexPay Support Agent)
• Dynamic HTTP HMAC Signature Authentication (X-RoleplayX-Signature)
• Multi-Turn Dialogue & Real Tool Calling Execution (1,000 synthetic runs)

             ↓

LEVEL 2.5: Commercial Pilot Simulation (STATUS: VALIDATED / READY)
──────────────────────────────────────────────────────────────────────────────
• Full Quality Engineering Loop: DISCOVER (7.1% Natural Boundary Drift)
  → ADAPTIVE STRESS (6.76x Amplification) → COMPARE → GATE: BLOCKED (Candidate v2)
  → FIX → GATE: APPROVED (Hardened v2.1) → PROVE (Cryptographic Evidence Package)

             ↓

LEVEL 3: Production Evidence & Customer Pilot (STATUS: PLANNED - PHASE 9)
──────────────────────────────────────────────────────────────────────────────
• Live Third-Party Customer Agent Connectivity (External Customer Endpoints)
• Human Gold Set Calibration (Pearson r >= 0.90, Cohen's kappa, MAE, Bias)
• Standard Regression Corpus (R01~R08) & Confusion Matrix (TP, TN, FP, FN, Precision, Recall)
• Formal B2B AI Agent Quality Certificate Issuance
```

---

## ⚡ Quality Engineering Loop (8-Stage Commercial Workflow)

$$\text{CONNECT} \longrightarrow \text{SIMULATE} \longrightarrow \text{EVALUATE} \longrightarrow \text{DISCOVER} \longrightarrow \text{ADAPTIVE STRESS} \longrightarrow \text{COMPARE} \longrightarrow \text{GATE} \longrightarrow \text{PROVE}$$

```text
                 ┌────────────────────────────────────────────────────────┐
                 │ External AI Agent: ApexPay Customer Support (v1.0.0)   │
                 └───────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
                 1. CONNECT & PREFLIGHT (8-Step Preflight Check)
                    - HTTP HMAC (X-RoleplayX-Signature) Verification
                    - 8/8 Preflight Checks Pass (0.24s Time to Benchmark)
                                             │
                                             ▼
                 2. SIMULATE & DISCOVER (1,000 Executed Synthetic Runs)
                    - 71 natural boundary violation occurrences (7.1% drift)
                    - Strict separation: Observed Divergence (Factual) vs Hypothesis (Provisional)
                    - 100% Reverse Traceability back to source MatrAIx Gold dataset
                                             │
                                             ▼
                 3. ADAPTIVE STRESS AMPLIFICATION (Targeted Cohort Synthesis)
                    - Adversarial dimensions (assertiveness >= 0.85, trust <= 0.25)
                    - Failure rate amplified from 7.1% -> 48.0% (6.76x amplification)
                                             │
                                             ▼
                 4. REGRESSION CONTROL & DEPLOYMENT GATE
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
             Agent v2.0.0 (Candidate)                          Agent v2.1.0 (Hardened Fix)
             - Overall mean score increases (91.5->93.8)       - Clean improvement across all cohorts (96.2)
             - Vulnerable cohort crashes (88.0->74.0)          - Boundary failures eliminated (0 occurrences)
                    │                                                 │
                    ▼                                                 ▼
             GATE: BLOCKED (409)                               GATE: APPROVED (200)
                    │                                                 │
                    ▼                                                 ▼
             FIX & RETEST                                      DEPLOY TO PRODUCTION
                                                                      │
                                                                      ▼
                                                               5. PROVE (Evidence Package)
                                                                  - 5 Customer Deliverables
                                                                  - SHA-256 Tamper Detection
```

---

## 📊 Commercial KPI Scorecard (Target vs Observed)

*Note: Measured under the ApexPay External-Agent Validation Fixture configuration.*

| KPI | Target SLA | Observed | Unit | Evaluation Basis |
| :--- | :---: | :---: | :---: | :--- |
| **Time to First Benchmark** | $< 60$ | **0.24** | sec | Agent onboarding and 8-step preflight verification SLA |
| **Preflight Success Rate** | $\ge 95$ | **100.0** | % | 8/8 checks passed (Schema, SLA, ToolCall, Resilience, PII) |
| **Hidden Failure Discovery Rate** | $\ge 1.0$ | **1.0** | clusters/1K | Un-injected natural boundary compliance drift detected |
| **Adaptive Amplification Factor** | $> 2.0$ | **6.76** | x | Targeted stress cohort amplification (7.1% $\to$ 48.0%) |
| **Critical Regression Detection** | $100.0$ | **100.0** | % | 100% detection on tested critical-regression cases (Simpson's Paradox) |
| **Observed False Positive Rate** | $< 5.0$ | **0.0** | % | 0 false blocks observed across clean candidate test cases |
| **Evidence Completeness** | $100.0$ | **100.0** | % | 13-stage end-to-end lineage linked with SHA256 checksums |
| **Measured Execution Cost** | $< 5.00$ | **$4.65** | $/1K runs | Infra: $0.85 + Agent Inference: $3.20 + Evaluation: $0.60 |
| **Runtime Orchestration Latency**| $< 3000$ | **43** | ms (p95) | RoleplayX internal engine p50: 42ms / p95: 43ms / p99: 43ms |

---

## 📦 Client-Facing Deliverables

1. `01_external-agent-profile.json`: Onboarding profile, protocol specs, HMAC parameters, tool calling configurations.
2. `02_preflight-report.json`: 8-step contract verification diagnostics, latency SLA benchmarks, PII redaction audit.
3. `03_baseline-benchmark-report.json`: 1,000 synthetic simulation runs, cohort breakdown, discriminative separation score.
4. `04_failure-discovery-report.json`: Natural failure clusters, factual observed divergences, provisional causal hypotheses.
5. `05_evidence-package/`: 13-stage lineage manifest (`contentx.evidence.v2`), 18 sub-artifacts, SHA-256 cryptographic tamper detection.

---

## 🏗️ Architecture Layers (P0 ~ P8)

| Layer | Module | Description |
| :--- | :--- | :--- |
| **P0: Contract & Replay** | `@workspace/simulation-contract` | Canonical `SimulationSpec`, Polymorphic Actors, `TrajectoryEvent`, and Dual-Mode Replay (`exact` vs `parameterized`). |
| **P1: Multi-Agent Benchmark** | `domains/simulation/runtime/` | Real adapters for OpenAI, Anthropic Claude, Google Gemini, Custom HTTP, and Mock. Multi-layer evaluation. |
| **P2: Population & Scale** | `domains/population/` | 6-Dimensional Population Generator, Stratified/Adaptive Samplers, and Cost-tracked Simulation Orchestrator. |
| **P3: Validity & Calibration** | `domains/evaluation/` | Judge Calibration ($r \ge 0.90$, Agreement $\ge 85\%$) & Cohen's $d$ Discriminative Power Analyzer. |
| **P4: External Gateway** | `domains/agent/gateway/` | HMAC Authentication, MCP Tool Calling Protocol, 8-Step Pre-flight Contract Checker, and PII Redactor. |
| **P5: Continuous QA & Gate** | `domains/evaluation/continuous/` | Version Registry, Immutable Context Hasher, Simpson's Paradox Regression Engine, and CI/CD Webhook Gate. |
| **P6: Enterprise SaaS** | `domains/saas/` | Multi-Tenant Organization/Project Hierarchy, RBAC (`owner`, `admin`, `engineer`, `analyst`, `viewer`), and Quota Metering. |
| **P7: Real-World Proof** | `domains/evaluation/failureDiscoveryEngine.ts` | 80 Benchmark Space cells, MatrAIx Provenance Resolver, 1,000+ simulation failure discovery, adaptive stress loop, and cryptographic Evidence Package. |
| **P8: Commercial Pilot Simulation**| `domains/evaluation/commercialPilotService.ts` | External Agent Validation Fixture (ApexPay), full Quality Engineering Loop (DISCOVER $\to$ STRESS $\to$ FIX $\to$ VERIFY), and KPI Scorecard. |

---

## 🚀 Quick Start

### Prerequisites
- Node.js $\ge 20$
- `pnpm` $\ge 9$

### Installation & Build
```bash
# Clone the repository
git clone https://github.com/Rexmeta/ContentX.git
cd ContentX

# Install dependencies
pnpm install

# Typecheck & Build libraries
pnpm run build
```

### Running Automated Test Suite
```bash
# Run all 40 domain & integration test suites (326 tests total)
pnpm --filter @workspace/simulation-contract test
AI_INTEGRATIONS_OPENAI_API_KEY=mock-key AI_INTEGRATIONS_OPENAI_BASE_URL=http://mock DATABASE_URL=postgres://mock:mock@localhost:5432/mock pnpm --filter @workspace/api-server test -- --exclude="**/*.db.test.ts"
```

---

## 🛡️ Security & Privacy
- **Tenant Isolation & IDOR Defense**: All routes strictly enforce caller organization boundaries with `403 Forbidden` response codes.
- **PII Redaction Engine**: Automatically redacts emails, telephone numbers, and financial credit card patterns before trajectory persistence.
- **HMAC Signatures**: External HTTP agent requests are verified using SHA-256 HMAC signatures (`X-RoleplayX-Signature`).
- **Cryptographic Tamper Detection**: Evidence packages include complete `checksums/SHA256SUMS` and root SHA-256 signatures for non-repudiation audit trails.

---

## 📄 License
MIT © 2026 ContentX / RoleplayX Team.
