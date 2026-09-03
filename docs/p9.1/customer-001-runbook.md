# Customer #001 Validation Runbook (SOP)

> **Baseline Version**: `P9.1-FROZEN (Commit: 4698b6b)`  
> **Objective**: Execute the first end-to-end commercial validation on an external enterprise AI agent and obtain empirical Level 3 Production Evidence.

---

## 1. Operating Principles & Guardrails

1. **Frozen Codebase**: Code modifications to simulation contracts, evaluators, lifecycle states, and gating predicates are strictly prohibited.
2. **Failure Segregation**: Metrics must strictly segregate target defect remediation from general/novel failure rates:
   - `overallFailureRate`: Total failure proportion across all test runs.
   - `targetDefectRate`: Initial baseline occurrence rate of the customer-confirmed defect.
   - `targetRecurrenceRate`: Must be strictly **0.0%** upon candidate retest.
   - `newFailureRate`: Frequency of any newly emerged failure modes during retest.
3. **Immutable Evaluation Context**: The `EvaluationContextHash` must be generated and preserved across benchmark runs, retests, and evidence sealing to guarantee reproducible verification.
4. **Maintenance Exception**: Any critical system defect discovered during operation must be recorded as a `P9.1-HOTFIX`, tested, and re-baselined before proceeding.

---

## 2. 12-Step Execution Protocol

```text
[1. CUSTOMER IDENTITY]
       ↓
[2. AGENT CONNECTION & PREFLIGHT]
       ↓
[3. GOLD SET INGESTION (N>=50, 3+ Experts)]
       ↓
[4. JUDGE CALIBRATION (Pearson r >= 0.90)]
       ↓
[5. PILOT BENCHMARK RUNS (100~300)]
       ↓
[6. NATURAL FAILURE DISCOVERY]
       ↓
[7. CUSTOMER QA DEFECT CONFIRMATION] (★ Critical Gate)
       ↓
[8. ADAPTIVE STRESS AMPLIFICATION]
       ↓
[9. CLIENT HARDENED FIX DEPLOYMENT]
       ↓
[10. CLOSED-LOOP RETEST (Target Recurrence = 0.0%)]
       ↓
[11. CANONICAL REGRESSION GATE (R01~R08)]
       ↓
[12. EVIDENCE PACKAGE v4 SEALING & CERTIFICATE ISSUANCE]
```

### Stage 1: Onboarding & Identity
- **Step 1 (Customer Identity)**: Collect corporate legal name, primary domain expert contacts, and contract reference (`contractReference`).
- **Step 2 (Agent Connection)**: Configure agent profile with `secretRef` vault pointers. Run the 8-Step Preflight Check (Schema, Latency SLA, Tool Calling, PII Redaction). Server generates `independenceStatus: "verified"`.

### Stage 2: Ground Truth & Calibration
- **Step 3 (Human Gold Set)**: Ingest at least 50 distinct trajectories rated by $\ge 3$ domain experts. Verify `multiRaterCoverage >= 90%` and `consensusCoverage >= 90%`.
- **Step 4 (Judge Calibration)**: Calculate Pearson $r \ge 0.90$, Cohen's $\kappa \ge 0.85$, and $MAE \le 5.0$. Confirm calibration status `CALIBRATED`.

### Stage 3: Discovery & Confirmation
- **Step 5 (Pilot Benchmark)**: Execute 100 to 300 multi-turn simulation runs across representative demographic and scenario cohorts.
- **Step 6 (Failure Discovery)**: Automatically cluster behavioral divergence patterns and isolate vulnerable cohorts.
- **Step 7 (Customer QA Review - Critical Gate)**: Client domain experts / QA leadership review discovered divergence traces and formally confirm at least one critical defect (`customerConfirmedFailures >= 1`).

### Stage 4: Remediation & Verification
- **Step 8 (Adaptive Stress)**: Apply dynamic perturbation to probe boundary parameters (amplification factor $> 1.0x$).
- **Step 9 (Hardened Fix)**: Client deploys candidate agent patch v2 (prompt, guardrail, or tool execution logic).
- **Step 10 (Closed-Loop Retest)**: Execute retest under identical scenario conditions:
  $$\text{targetRecurrenceRate} = 0.0\% \quad \land \quad \text{overallFailureRate} \le \text{baselineFailureRate}$$
- **Step 11 (Regression Gate)**: Run RoleplayX Canonical Regression Corpus (R01~R08) to verify accuracy $\ge 85\%$ and FPR $\le 10\%$.

### Stage 5: Sealing & Non-Repudiation
- **Step 12 (Evidence Sealing)**: Compile 22 standardized sub-artifacts into Evidence Package v4 (`contentx.evidence.v4`). Generate `22_SHA256SUMS` and root checksum. Issue `AI Agent Quality Certificate` (Scope: `customer_pilot`).

---

## 3. Success Declaration Benchmark

The milestone is achieved when the client validation yields the empirical proof statement:

> *"RoleplayX identified a customer-confirmed defect in an independently connected AI agent, guided targeted stress testing, verified remediation through retest (target defect recurrence = 0.0%), and produced cryptographically integrity-verifiable evidence of the result."*
