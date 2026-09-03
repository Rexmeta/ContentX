# Phase 10 (P9): Production Evidence & Customer Validation Implementation Audit

## 1. Executive Summary
This audit inspects the entire existing ContentX / RoleplayX codebase across P0 through P8, identifies reusable domain services, maps dependencies, and establishes explicit architecture decisions for **Phase 10 (P9): Production Evidence & Customer Validation**.

---

## 2. Capability Mapping (P8 Existing vs P9 Required)

| Existing P8 Capability | P9 Dependency Layer | Reusable Module / File | Missing P9 Capability | Implementation Decision | Risk & Mitigation |
|:---|:---|:---|:---|:---|:---|
| **P0: Canonical Contract** | SimulationSpec, Trajectory, Actor | `@workspace/simulation-contract/src/spec.ts`, `trajectory.ts` | Customer ownership metadata on actors | Extend with non-breaking optional fields | Stable schema; do not modify core replay engine |
| **P1: Multi-Agent Benchmark** | MultiLayerEvaluationEngine | `artifacts/api-server/src/domains/evaluation/multiLayerEngine.ts` | Multi-rater human gold consensus comparison | Build `HumanGoldCalibrationEngine` on top of `MultiLayerEvaluationEngine` | Avoid hardcoding human scores; compute exact Pearson $r$ and Cohen's $\kappa$ |
| **P2: Population & Scale** | 6D Population & Stratified Samplers | `artifacts/api-server/src/domains/population/` | Standardized R01~R08 Regression Scenarios | Reference canonical 8 cohorts & scenarios in R01~R08 | Keep population deterministic with seed policy |
| **P3: Validity & Calibration** | Calibration Model | `artifacts/api-server/src/domains/evaluation/judgeCalibration.ts` | Real multi-expert human gold set & Fleiss/Cohen $\kappa$ | Implement `HumanGoldSetManager` with pseudonymized expert raters | Never declare `CALIBRATED` unless empirical thresholds ($r \ge 0.90, \kappa \ge 0.85$) are met |
| **P4: External Gateway** | HTTP HMAC & 8-Step Preflight | `artifacts/api-server/src/domains/agent/gateway/`, `contractChecker.ts` | Customer independence attestation model | Implement `CustomerAgentAttestationService` and `ownershipType: "third_party_customer"` | Prevent silent promotion of fixtures to real customers |
| **P5: Continuous QA & Gate** | Version Registry & Simpson's Gate | `artifacts/api-server/src/domains/evaluation/continuous/` | Known-good / Known-bad Confusion Matrix ($N \ge 20$) | Implement `RegressionCorpusEngine` with exact TP, TN, FP, FN calculation | Explicitly handle zero denominators without NaN |
| **P6: Enterprise SaaS** | Tenant Isolation & RBAC | `artifacts/api-server/src/domains/saas/authMiddleware.ts` | P9 Customer Pilot, Audit Logs & Quality Certificate RBAC | Enforce `owner`/`admin`/`engineer`/`analyst` permissions and `403 Forbidden` | Validate cross-tenant boundaries with negative tests |
| **P7: Real-World Proof** | Failure Discovery & Adaptive Stress | `failureDiscoveryEngine.ts`, `adaptiveStressEngine.ts` | Customer Failure Review & Feedback Loop | Implement `CustomerPilotService` with `CustomerFailureReview` | Retain factual divergence vs provisional hypothesis separation |
| **P8: Commercial Pilot Simulation** | Evidence Package Builder v2 | `saas/evidencePackageBuilder.ts` | Evidence Package v3 (`contentx.evidence.v3`) & AI Agent Quality Certificate | Implement `EvidencePackageV3Builder` with 20 sub-artifacts & SHA-256 tamper detection | Support v2 backward compatibility; issue `DRAFT`/`ISSUED`/`REVOKED` certificates |

---

## 3. Strict Non-Negotiable Terminology & Boundaries

```text
Synthetic Simulation ≠ Real-world Evidence
Reference Agent ≠ External Customer Agent
External Validation Fixture ≠ Customer Pilot
Observed Behavioral Divergence ≠ Causal Finding
Causal Hypothesis ≠ Proven Causality
Synthetic Judge Calibration ≠ Human Calibration
SHA-256 Integrity Check ≠ Tamper Prevention / Non-repudiation
100% detection in tested cases ≠ Universal 100% detection
0 observed FP in tested scenario ≠ Statistically established FPR = 0%
```

---

## 4. Four Mandatory P9 Gates

```text
P9 Gate #1: REAL CUSTOMER AGENT CONNECT
├── ExternalAgentRegistration (ownershipType: "third_party_customer")
├── CustomerAgentAttestation (independenceStatus: "verified")
└── 8-Step Preflight Check & Evidence Traceability

P9 Gate #2: HUMAN GOLD SET CALIBRATION
├── Multi-rater Gold Annotations (pseudonymized experts)
├── Consensus computation & metric analysis (Pearson r, Cohen's kappa, MAE, Bias)
└── Status: "PROVISIONAL" vs "CALIBRATED" vs "FAILED"

P9 Gate #3: STANDARD REGRESSION CORPUS (R01 ~ R08)
├── R01 (Boundary Violation), R02 (Escalation Delay), R03 (Tool Misuse), R04 (Policy Bypass)
├── R05 (Empathy Deficit), R06 (Hallucination), R07 (Context Loss), R08 (Unauthorized Concession)
├── Known-Good vs Known-Bad Test Corpus (Confusion Matrix: TP, TN, FP, FN, Precision, Recall, FPR, FNR)
└── Simpson's Paradox Regression Gate (Cohort-level vs Overall)

P9 Gate #4: CUSTOMER PILOT + AI AGENT QUALITY CERTIFICATE
├── CustomerPilot model & CustomerFailureReview loop
├── Evidence Package v3 (20 sub-artifacts, SHA256SUMS)
└── Formal AI Agent Quality Certificate (DRAFT / ISSUED / REVOKED)
```

---

## 5. Implementation Roadmap
- **Step 2**: Define canonical schemas in `lib/simulation-contract/src/productionEvidence.ts` and export via index.
- **Step 3-9**: Implement domain services in `artifacts/api-server/src/domains/productionEvidence/`.
- **Step 10**: Create P9 API routes in `artifacts/api-server/src/routes/productionEvidenceRoutes.ts`.
- **Step 11**: Build rigorous negative & positive test suites.
- **Step 12**: Run full regression verification across all 40+ test suites.
- **Step 13**: Produce `P9-ACCEPTANCE-REPORT.md` and commit to Git.
