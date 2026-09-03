# P9 Gate #2: Human Gold Set Calibration (under Human Gold Set v1)

## 1. Objective
Empirically validate whether automated LLM judges and multi-layer evaluators correlate with multi-expert human judgment under a defined gold standard dataset.

## 2. Multi-Rater Architecture
```text
Gold Trajectory (N = 20)
       ├── Expert A (Pseudonymized)
       ├── Expert B (Pseudonymized)
       └── Expert C (Pseudonymized)
               │
               ▼
       Human Consensus Score
               │
       ┌───────┴───────┐
       ▼               ▼
Human Gold Score   LLM Judge Score
       │               │
       └───────┬───────┘
               ▼
   Empirical Calibration Results
```

## 3. Statistical Acceptance Criteria for CALIBRATED Status
- **Sample Size ($N$)**: $\ge 20$ fully annotated trajectories across balanced cohorts.
- **Pearson Correlation ($r$)**: $r \ge 0.90$ with human consensus scores.
- **Cohen's $\kappa$**: $\kappa \ge 0.85$ (**LLM Judge vs Human Consensus binary pass/fail agreement**).
- **Mean Absolute Error ($MAE$)**: $MAE \le 5.0$ points on a 100-point rubric.
- **Status Assignment**:
  - `CALIBRATED under Human Gold Set v1`: Acceptance criteria met for the evaluated dataset.
  - `PROVISIONAL`: Synthetic reference calibration or sample size $N < 20$.
  - `FAILED`: Correlation $r < 0.70$ or missing annotations.

> [!NOTE]
> `CALIBRATED under Human Gold Set v1` confirms evaluator accuracy against the tested benchmark dataset. It does NOT claim universal calibration across unmodeled, future enterprise domains.
