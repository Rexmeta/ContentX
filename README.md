# ContentX & RoleplayX: AI Agent Quality Infrastructure

> **"Test AI Agents Before They Reach Production."**  
> *Connect any AI agent, simulate thousands of synthetic users, discover hidden failure patterns, and block unsafe releases.*

[![Build & Test](https://img.shields.io/badge/Tests-315%2F315%20Passing-brightgreen)](https://github.com/Rexmeta/ContentX)
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

## 🛡️ Three Levels of Scientific Proof

We strictly distinguish three levels of proof:

```text
LEVEL 1: Infrastructure Proof (Current Status: VALIDATED & PRODUCTION READY)
──────────────────────────────────────────────────────────────────────────────
• Reference Agent Integration Verified
• 1,000+ Executed Synthetic Simulation Trajectories
• Controlled Failure Injection & Closed-Loop Adaptive Stress Amplification (6.42x)
• Multi-Factor Regression Intelligence & Tamper Detection Checksums

             ↓

LEVEL 2: External Agent Proof (Next: Phase 8 Pilot Validation)
──────────────────────────────────────────────────────────────
• Real Standalone External AI Agents (Customer Service, FinTech, E-Commerce)
• Real In-The-Wild Behavioral Divergence & Edge Failure Discovery
• True Version-over-Version Candidate Regression & Automated Gating

             ↓

LEVEL 3: Production Evidence (Commercial Operations)
────────────────────────────────────────────────────
• Production-like Traffic Simulation & Live Guardrails
• Human Gold Set Calibration Certification (r >= 0.90)
• Production Deployment Outcome Tracking & SLA Defense
```

---

## ⚡ 8-Stage Commercial Workflow

$$\text{CONNECT} \longrightarrow \text{SIMULATE} \longrightarrow \text{EVALUATE} \longrightarrow \text{DISCOVER} \longrightarrow \text{ADAPTIVE STRESS} \longrightarrow \text{COMPARE} \longrightarrow \text{GATE} \longrightarrow \text{PROVE}$$

1. **CONNECT**: Onboard any AI agent via HTTP (`X-RoleplayX-Signature`), MCP, or SDK with an automated **8-Step Pre-flight Contract Check**.
2. **SIMULATE**: Execute large-scale synthetic simulations across 6 population dimensions and 8 Reference Benchmark cohorts (Calm, Frustrated, Impatient, VIP, Policy-Aware, Skeptical, Boundary Tester, Adversarial).
3. **EVALUATE**: Run 3-Layer Evaluation (Deterministic Invariants, Trace Pattern Extraction, Calibrated Multi-Dimension Rubrics).
4. **DISCOVER**: Cluster hidden failure patterns, calculate affected cohort rates, and strictly separate **Observed Behavioral Divergence** (factual) from **Causal Hypotheses** (provisional).
5. **ADAPTIVE STRESS**: Automatically map discovered weaknesses to targeted population dimensions (`assertiveness >= 0.85`, `trust <= 0.25`) to retest and amplify failure modes.
6. **COMPARE**: Contrast Candidate ($v_2$) vs Baseline ($v_1$) with identical `EvaluationContextHash` to prevent **Simpson's Paradox** (overall average score gains hiding severe sub-cohort drops).
7. **GATE**: Block unsafe candidate releases via automated CI/CD webhooks (`BLOCKED` / `WARNING` / `APPROVED` with explicit reason codes).
8. **PROVE**: Export 13-stage immutable **Evidence Package** with cryptographic SHA-256 integrity verification (`checksums/SHA256SUMS`).

---

## 📊 Commercial KPIs

| KPI | Description | Target SLA |
| :--- | :--- | :--- |
| **Time to First Benchmark** | Time from agent registration to initial report | $< 60\text{ seconds}$ |
| **Preflight Success Rate** | 8-step contract verification pass rate | $\ge 95\%$ |
| **Hidden Failure Discovery Rate** | Number of distinct failure clusters identified | $\ge 1\text{ per 200 runs}$ |
| **Adaptive Amplification Factor** | Weakness amplification under targeted stress | $> 2.0\times$ |
| **Regression Detection Rate** | Sensitivity to sub-cohort and metric degradation | $100\%$ on critical drops |
| **False Positive / Negative Rate** | Accuracy of automated `BLOCKED` gate decisions | $< 5\%$ False Positive |
| **Evidence Completeness** | Traceability from evidence ID to MatrAIx source | $100\%$ |
| **Simulation Cost & Speed** | Infrastructure execution cost per 1,000 runs | $<\$5.00 / 1\text{K runs}, < 3\text{s p95}$ |

---

## 🏗️ Architecture Layers (P0 ~ P7)

| Layer | Module | Description |
| :--- | :--- | :--- |
| **P0: Contract & Replay** | `@workspace/simulation-contract` | Canonical `SimulationSpec`, Polymorphic Actors, `TrajectoryEvent`, and Dual-Mode Replay (`exact` vs `parameterized`). |
| **P1: Multi-Agent Benchmark** | `domains/simulation/runtime/` | Real adapters for OpenAI, Anthropic Claude, Google Gemini, Custom HTTP, and Mock. Multi-layer evaluation. |
| **P2: Population & Scale** | `domains/population/` | 6-Dimensional Population Generator, Stratified/Adaptive Samplers, and Cost-tracked Simulation Orchestrator. |
| **P3: Validity & Calibration** | `domains/evaluation/` | Judge Calibration ($r \ge 0.90$, Agreement $\ge 85\%$) & Cohen's $d$ Discriminative Power Analyzer. |
| **P4: External Gateway** | `domains/agent/gateway/` | HMAC Authentication, MCP Tool Calling Protocol, 8-Step Pre-flight Contract Checker, and PII Redactor. |
| **P5: Continuous QA & Gate** | `domains/evaluation/continuous/` | Version Registry, Immutable Context Hasher, Simpson's Paradox Regression Engine, and CI/CD Webhook Gate. |
| **P6: Enterprise SaaS** | `domains/saas/` | Multi-Tenant Organization/Project Hierarchy, RBAC (`owner`, `admin`, `engineer`, `analyst`, `viewer`), and Quota Metering. |
| **P7: Real-World Proof & Validation** | `domains/evaluation/failureDiscoveryEngine.ts` | 80 Benchmark Space cells, MatrAIx Provenance Resolver, 1,000+ simulation failure discovery, adaptive stress loop, and cryptographic Evidence Package. |

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
# Run all 39 domain & integration test suites (315 tests total)
pnpm --filter @workspace/simulation-contract test
AI_INTEGRATIONS_OPENAI_API_KEY=mock-key AI_INTEGRATIONS_OPENAI_BASE_URL=http://mock DATABASE_URL=postgres://mock:mock@localhost:5432/mock pnpm --filter @workspace/api-server test -- --exclude="**/*.db.test.ts"
```

---

## 📡 Key API Endpoints

```
POST /api/v1/organizations                    - Create tenant organization
POST /api/v1/organizations/:id/projects       - Create project
POST /api/v1/organizations/:id/api-keys       - Generate scoped API key
POST /api/v1/external-agents/register         - Register external AI agent
POST /api/v1/external-agents/:id/contract-check - 8-Step pre-flight check
POST /api/v1/experiments/run                  - Run multi-persona benchmark
GET  /api/v1/projects/:id/failure-explorer    - Interactive failure pattern explorer
POST /api/v1/benchmarks/adaptive-loop         - Adaptive adversarial stress test
POST /api/v1/agent-versions                   - Register candidate agent version
POST /api/v1/webhooks/deployment              - Continuous QA CI/CD deployment gate
POST /api/v1/commercial-validation/runs       - Execute reference benchmark validation run
POST /api/v1/commercial-validation/packages/:id/verify - Cryptographic evidence package verification
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
