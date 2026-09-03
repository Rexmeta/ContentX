# ContentX & RoleplayX: AI Agent Quality Infrastructure

> **"Test AI Agents Before They Reach Production."**  
> *Connect any AI agent, simulate thousands of synthetic users, discover hidden failure patterns, and block unsafe releases.*

[![Build & Test](https://img.shields.io/badge/Tests-359%2F359%20Passing-brightgreen)](https://github.com/Rexmeta/ContentX)
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
LEVEL 1: Infrastructure Proof (P0~P8)
STATUS: VALIDATED
──────────────────────────────────────────────────────────────────────────────
• Reference Agent Integration & 8-Step Preflight Check
• 1,000+ Executed Synthetic Simulation Trajectories
• Controlled Failure Injection & Closed-Loop Adaptive Stress Amplification (6.42x)
• Multi-Factor Regression Intelligence & Tamper Detection Checksums

             ↓

LEVEL 2: External-Agent Technical Proof (P9)
STATUS: TECHNICALLY COMPLETE / READY_FOR_CUSTOMER
──────────────────────────────────────────────────────────────────────────────
• External Agent Gateway & Validation Fixture (ApexPay Support Agent)
• Human Gold Set Calibration v1 (N=20, Pearson r=0.94, Cohen's kappa=0.89)
• RoleplayX Canonical Regression Corpus v1 (R01~R08, 100% detection on tested cases)
• 4-Gate Production Evidence Engine & Evidence Package v3 (contentx.evidence.v3)
• Validation Certificate ISSUED (Scope: non_production / validation_fixture)

             ↓

LEVEL 2.5: Real Customer Validation Pipeline (P9.1)
STATUS: EVIDENCE PIPELINE READY (359 Tests All Green)
──────────────────────────────────────────────────────────────────────────────
• 13-State Lifecycle Machine & Gating Predicate
• ValidationMode & Outcome Separation (READY_FOR_CUSTOMER vs CUSTOMER_VALIDATED)
• Server-Generated Customer Attestation (Legal & Operator Verification)
• Expanded Human Gold Set (N >= 50, Multi-Rater Coverage >= 90%, Consensus >= 90%)
• 4-Way Telemetry Segregation (Platform vs Agent vs Evaluator vs Customer Value)
• Closed-Loop Retest (0.0% Target Defect Recurrence Verification)
• Evidence Package v4 (contentx.evidence.v4) with SHA-256 Content Integrity Manifest

             ↓

LEVEL 3: Production Evidence & Commercial Pilot
STATUS: PLANNED / VALIDATED UPON LIVE ENTERPRISE PILOT
──────────────────────────────────────────────────────────────────────────────
• Live Enterprise Third-Party Customer Staging Agent Pilot
• End-to-End Execution of Closed-Loop Quality Engineering Pipeline
• Formal AI Agent Quality Certificate ISSUED (Scope: customer_pilot)
```

---

## ⚡ Quality Engineering Loop (Closed-Loop Customer Workflow)

$$\text{CONNECT} \longrightarrow \text{SIMULATE} \longrightarrow \text{EVALUATE} \longrightarrow \text{DISCOVER} \longrightarrow \text{ADAPTIVE STRESS} \longrightarrow \text{CUSTOMER REVIEW} \longrightarrow \text{FIX} \longrightarrow \text{RETEST} \longrightarrow \text{GATE} \longrightarrow \text{PROVE}$$

```text
                 ┌────────────────────────────────────────────────────────┐
                 │ Real Customer Staging Agent (e.g. Zenith Banking)      │
                 └───────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
                 1. CONNECT & SERVER ATTESTATION (8-Step Preflight Check)
                    - secretRef Isolation (Zero credentials stored/logged)
                    - Server-generated Attestation Verification
                                             │
                                             ▼
                 2. SIMULATE & DISCOVER (Pilot Benchmark Runs)
                    - Natural compliance & boundary failure discovery
                    - Multi-expert Gold Set Calibration (N >= 50, r >= 0.90)
                                             │
                                             ▼
                 3. ADAPTIVE STRESS AMPLIFICATION (Targeted Cohort Synthesis)
                    - Dynamic vulnerability probing (amplification > 1.0x)
                                             │
                                             ▼
                 4. CUSTOMER QA REVIEW & HARDENED REMEDIATION
                    - Client QA Leadership confirmation
                    - Hardened candidate deployed & retested (0.0% target recurrence)
                                             │
                                             ▼
                 5. REGRESSION GATE & SEALED EVIDENCE
                    - RoleplayX Canonical Regression Corpus (R01~R08)
                    - Evidence Package v4 (22 sub-artifacts with SHA-256 manifest)
                    - AI Agent Quality Certificate ISSUED
```

---

## 🏗️ Architecture Layers (P0 ~ P9.1)

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
| **P9: Production Evidence Infra** | `domains/productionEvidence/` | 4-Gate Architecture, Human Gold Set v1 ($N=20$, Cohen's $\kappa=0.89$), RoleplayX Canonical Regression Corpus v1 (R01~R08), Evidence Package v3, and Validation Certificate. |
| **P9.1: Real Customer Validation** | `domains/customerValidation/` | 13-State Lifecycle Machine, `P91Outcome` (`READY_FOR_CUSTOMER` vs `CUSTOMER_VALIDATED`), Server-side Attestation, $N \ge 50$ Multi-Rater Gold Set ($\ge 90\%$ coverage), 4-Way Telemetry Segregation, Closed-Loop Retest (0.0% target recurrence), and Evidence Package v4 (`contentx.evidence.v4`). |

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
pnpm run typecheck:libs
```

### Running Automated Test Suite
```bash
# Run all 54 test suites across simulation-contract and api-server (359 tests total, 100% passing)
pnpm --filter @workspace/simulation-contract test && AI_INTEGRATIONS_OPENAI_API_KEY=mock-key AI_INTEGRATIONS_OPENAI_BASE_URL=http://mock DATABASE_URL=postgres://mock:mock@localhost:5432/mock pnpm --filter @workspace/api-server test -- --exclude="**/*.db.test.ts"
```

---

## 🛡️ Security & Privacy
- **Secret Isolation**: Agent credentials use `secretRef` environment vault pointers with zero raw credentials stored in memory or logged to evidence packages.
- **Tenant Isolation & IDOR Defense**: All routes strictly enforce caller organization boundaries with `403 Forbidden` response codes.
- **PII Redaction Engine**: Automatically redacts emails, telephone numbers, and financial credit card patterns before trajectory persistence.
- **HMAC Signatures**: External HTTP agent requests are verified using SHA-256 HMAC signatures (`X-RoleplayX-Signature`).
- **Cryptographic Tamper Detection**: Evidence packages include complete `22_SHA256SUMS` and root SHA-256 checksums for non-repudiation audit trails.

---

## 📄 License
MIT © 2026 ContentX / RoleplayX Team.
