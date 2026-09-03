# P9.1: Closed-Loop Pilot Retest & Defect Remediation Specification

## 1. Closed-Loop Lifecycle

$$\text{DISCOVER} \to \text{ADAPTIVE STRESS} \to \text{CUSTOMER QA REVIEW} \to \text{HARDENED FIX} \to \text{RETEST} \to \text{REGRESSION GATE}$$

```text
1. DISCOVER: Baseline benchmark runs (100~300) uncover natural failure clusters.
2. ADAPTIVE STRESS: Cohort parameters are dynamically tuned to probe the failure boundary (amplification > 1.0x).
3. CUSTOMER QA REVIEW: Client domain leaders review and confirm failure validity.
4. HARDENED FIX: Client engineering patches the prompt, tools, or policy guardrails and deploys candidate v2.
5. RETEST: RoleplayX executes retest under identical conditions to verify target defect remediation.
6. REGRESSION GATE: Canonical Regression Corpus (R01~R08) ensures zero behavioral backsliding.
```

---

## 2. Failure Recurrence Segregation

During retest, failures are segregated to isolate target remediation from unrelated novel failure modes:

- **`targetRecurrenceRate`**: Must be **0.0%** for confirmed target defects.
- **`newFailureRate`**: Rates of newly emerged failure modes during retest.
- **`overallFailureRate`**: Overall failure rate ($\text{targetRecurrenceRate} + \text{newFailureRate}$).

Retest passes only when:
$$\text{targetRecurrenceRate} = 0.0 \land \text{overallFailureRate} \le \text{baselineFailureRate}$$
