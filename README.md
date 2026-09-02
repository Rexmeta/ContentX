# ContentX & RoleplayX: AI Agent Quality Infrastructure

> **"Test AI Agents Before They Reach Production."**  
> *Connect any AI agent, simulate thousands of synthetic users, discover hidden failure patterns, and block unsafe releases.*

[![Build & Test](https://img.shields.io/badge/Tests-283%2F283%20Passing-brightgreen)](https://github.com/Rexmeta/ContentX)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 🧭 Overview & Platform Separation

ContentX and RoleplayX together form a production-grade **AI Agent Quality & Simulation Platform**:

```
                 AI AGENT QUALITY PLATFORM
                           │
             ┌─────────────┴─────────────┐
             │                           │
         ContentX                    RoleplayX
             │                           │
   Simulation Compiler          Agent QA Infrastructure
             │                           │
      WHAT TO TEST              HOW TO TEST
             │                           │
   Scenario / Persona          Runtime / Evaluation
   Population / Rubric         Regression / Evidence
   SimulationSpec              Deployment Gate
             │                           │
             └─────────────┬─────────────┘
                           │
                    Benchmark Asset
```

- **ContentX (Simulation Compiler)**: Author scenarios, multi-dimensional populations, rubrics, and formal `SimulationSpec` definitions.
- **RoleplayX (Agent QA Infrastructure)**: Connect external agents (OpenAI, Claude, Gemini, HTTP, MCP), orchestrate 1,000+ simulation runs, evaluate with multi-layer judges, detect Simpson's Paradox regressions, and gate CI/CD deployments.

---

## ⚡ 7-Verb Product Workflow

$$\text{CONNECT} \longrightarrow \text{SIMULATE} \longrightarrow \text{EVALUATE} \longrightarrow \text{DISCOVER} \longrightarrow \text{COMPARE} \longrightarrow \text{GATE} \longrightarrow \text{PROVE}$$

1. **CONNECT**: Onboard any AI agent via HTTP (`X-RoleplayX-Signature`), MCP, or SDK with an automated **8-Step Pre-flight Contract Check**.
2. **SIMULATE**: Execute large-scale synthetic simulations across 6 population dimensions and 5 sampling strategies (Stratified, Extreme Edge, Adversarial, Adaptive).
3. **EVALUATE**: Run 3-Layer Evaluation (Deterministic Rules, Trace Analysis, Calibrated LLM Judge with human reference calibration).
4. **DISCOVER**: Inspect hidden failure patterns, affected cohorts, and observed behavioral divergences in the **Failure Explorer**.
5. **COMPARE**: Contrast Candidate ($v_2$) vs Baseline ($v_1$) across overall scores, dimensions, and sub-cohorts to prevent **Simpson's Paradox**.
6. **GATE**: Block unsafe candidate releases via automated CI/CD webhooks (`POST /api/v1/webhooks/deployment` $\to$ `409 BLOCKED` / `200 APPROVED`).
7. **PROVE**: Export immutable, cryptographically verifiable `BenchmarkDatasetPackage` (SHA-256 Checksum) for compliance and reproducibility.

---

## 🏗️ Architecture Layers (P0 ~ P6.5)

| Layer | Module | Description |
| :--- | :--- | :--- |
| **P0: Contract & Replay** | `@workspace/simulation-contract` | Canonical `SimulationSpec`, Polymorphic Actors, `TrajectoryEvent`, and Dual-Mode Replay (`exact` vs `parameterized`). |
| **P1: Multi-Agent Benchmark** | `domains/simulation/runtime/` | Real adapters for OpenAI, Anthropic Claude, Google Gemini, Custom HTTP, and Mock. Multi-layer evaluation. |
| **P2: Population & Scale** | `domains/population/` | 6-Dimensional Population Generator, Stratified/Adaptive Samplers, and Cost-tracked Simulation Orchestrator. |
| **P3: Validity & Calibration** | `domains/evaluation/` | Judge Calibration ($r \ge 0.90$, Agreement $\ge 85\%$) & Cohen's $d$ Discriminative Power Analyzer. |
| **P4: External Gateway** | `domains/agent/gateway/` | HMAC Authentication, MCP Tool Calling Protocol, 8-Step Pre-flight Contract Checker, and PII Redactor. |
| **P5: Continuous QA & Gate** | `domains/evaluation/continuous/` | Version Registry, Immutable Context Hasher, Simpson's Paradox Regression Engine, and CI/CD Webhook Gate. |
| **P6: Enterprise SaaS** | `domains/saas/` | Multi-Tenant Organization/Project Hierarchy, RBAC (`owner`, `admin`, `engineer`, `analyst`, `viewer`), and Quota Metering. |
| **P6.5: Hardening & Security**| `saas/authMiddleware.ts` | Cross-Tenant Isolation & IDOR Penetration Defense, 7-Entity Correlation Lineage (`requestId` $\to$ `deploymentId`). |

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

### Running Locally
```bash
# Start Backend API Server (Port 3000)
pnpm --filter @workspace/api-server run dev

# Start Frontend Workspace (Port 5173)
pnpm --filter @workspace/contentx run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:3000](http://localhost:3000)

### Running Automated Test Suite
```bash
# Run all 34 domain & integration test suites (283 tests total)
AI_INTEGRATIONS_OPENAI_API_KEY=mock-key AI_INTEGRATIONS_OPENAI_BASE_URL=http://mock DATABASE_URL=postgres://mock:mock@localhost:5432/mock pnpm --filter @workspace/api-server test
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
POST /api/v1/benchmarks/:id/package           - Export immutable dataset package
```

---

## 🛡️ Security & Privacy
- **Tenant Isolation & IDOR Defense**: All routes strictly enforce caller organization boundaries with `403 Forbidden` response codes.
- **PII Redaction Engine**: Automatically redacts emails, telephone numbers, and financial credit card patterns before trajectory persistence.
- **HMAC Signatures**: External HTTP agent requests are verified using SHA-256 HMAC signatures (`X-RoleplayX-Signature`).

---

## 📄 License
MIT © 2026 ContentX / RoleplayX Team.
